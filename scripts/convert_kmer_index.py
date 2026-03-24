#!/usr/bin/env python3

from __future__ import annotations

import argparse
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
import gzip
import io
import json
import os
import pickle
import re
import sys
from pathlib import Path
from typing import Any, Iterator
from urllib.parse import urlparse

try:
    import boto3
    from botocore.client import BaseClient
except ImportError:
    boto3 = None
    BaseClient = Any


FILE_NAME_RE = re.compile(r"^kmer_index_k(?P<k>\d+)\.pkl$")
SHARD_PREFIX_LENGTH = 5


class Match(tuple):
    __slots__ = ()

    def __new__(cls, *args: Any) -> "Match":
        if len(args) == 1 and isinstance(args[0], tuple):
            values = args[0]
        else:
            values = args

        if len(values) != 6:
            raise TypeError(f"Expected 6 match fields, received {len(values)}")

        return tuple.__new__(cls, values)

    @property
    def gene(self) -> str:
        return self[0]

    @property
    def chrom(self) -> str:
        return self[1]

    @property
    def pos(self) -> int:
        return self[2]

    @property
    def strand(self) -> str:
        return self[3]

    @property
    def tss(self) -> int:
        return self[4]

    @property
    def dist_to_tss(self) -> int:
        return self[5]


class MatchUnpickler(pickle.Unpickler):
    def find_class(self, module: str, name: str) -> Any:
        if module == "kmer_index_types" and name == "Match":
            return Match
        return super().find_class(module, name)


class OutputTarget:
    def describe(self) -> str:
        raise NotImplementedError

    def write_text(self, relative_path: str, content: str) -> None:
        raise NotImplementedError

    def write_gzip_json(self, relative_path: str, payload: dict[str, Any]) -> None:
        raise NotImplementedError


class LocalOutputTarget(OutputTarget):
    def __init__(self, root: Path) -> None:
        self.root = root

    def describe(self) -> str:
        return str(self.root)

    def write_text(self, relative_path: str, content: str) -> None:
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def write_gzip_json(self, relative_path: str, payload: dict[str, Any]) -> None:
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        with gzip.open(path, "wt", encoding="utf-8") as file:
            json.dump(payload, file, separators=(",", ":"))


class R2OutputTarget(OutputTarget):
    def __init__(self, bucket: str, prefix: str, client: BaseClient) -> None:
        self.bucket = bucket
        self.prefix = prefix.strip("/")
        self.client = client

    def describe(self) -> str:
        if self.prefix:
            return f"r2://{self.bucket}/{self.prefix}"
        return f"r2://{self.bucket}"

    def write_text(self, relative_path: str, content: str) -> None:
        self.client.put_object(
            Bucket=self.bucket,
            Key=self._key(relative_path),
            Body=content.encode("utf-8"),
            ContentType="application/json; charset=utf-8",
        )

    def write_gzip_json(self, relative_path: str, payload: dict[str, Any]) -> None:
        buffer = io.BytesIO()
        with gzip.GzipFile(fileobj=buffer, mode="wb") as file:
            file.write(json.dumps(payload, separators=(",", ":")).encode("utf-8"))

        self.client.put_object(
            Bucket=self.bucket,
            Key=self._key(relative_path),
            Body=buffer.getvalue(),
            ContentType="application/json",
            ContentEncoding="gzip",
        )

    def _key(self, relative_path: str) -> str:
        if self.prefix:
            return f"{self.prefix}/{relative_path}"
        return relative_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert pickle kmer indexes into gzip-compressed JSON shards."
    )
    parser.add_argument(
        "source_dir",
        nargs="?",
        help="Directory containing index_metadata.pkl and kmer_index_k*.pkl files.",
    )
    parser.add_argument(
        "--output",
        help=(
            "Output destination. Use a local path or r2://bucket/optional-prefix. "
            "Defaults to json_shards under the source directory."
        ),
    )
    parser.add_argument(
        "--write-workers",
        type=int,
        default=1,
        help="Number of shard files to gzip/write in parallel. Default: 1.",
    )
    return parser.parse_args()


def prompt_source_directory() -> Path:
    raw_value = input("Enter the path to the kmer index directory: ").strip()
    if not raw_value:
        raise SystemExit("No directory provided.")

    directory = Path(raw_value).expanduser().resolve()
    if not directory.exists():
        raise SystemExit(f"Directory does not exist: {directory}")
    if not directory.is_dir():
        raise SystemExit(f"Path is not a directory: {directory}")

    return directory


def prompt_output_destination(default_output: Path) -> str:
    raw_value = input(f"Enter the output path or R2 URL [{default_output}]: ").strip()
    return raw_value or str(default_output)


def load_pickle(path: Path) -> Any:
    with path.open("rb") as file:
        return MatchUnpickler(file).load()


def shard_key_for_kmer(kmer: str) -> str:
    return kmer[: min(SHARD_PREFIX_LENGTH, len(kmer))]


def match_to_json(match: Any, field_names: tuple[str, ...]) -> dict[str, Any]:
    if isinstance(match, Match):
        return {
            "gene": match.gene,
            "chrom": match.chrom,
            "pos": match.pos,
            "strand": match.strand,
            "tss": match.tss,
            "dist_to_tss": match.dist_to_tss,
        }

    if isinstance(match, tuple) and len(match) == len(field_names):
        return dict(zip(field_names, match))

    raise TypeError(f"Unsupported match value: {type(match)!r}")


def count_shards(sorted_kmers: list[str]) -> int:
    total = 0
    previous_shard_key: str | None = None

    for kmer in sorted_kmers:
        shard_key = shard_key_for_kmer(kmer)
        if shard_key != previous_shard_key:
            total += 1
            previous_shard_key = shard_key

    return total


def iter_shards(
    kmer_index: dict[str, list[Any]],
    field_names: tuple[str, ...],
) -> tuple[int, Iterator[tuple[str, dict[str, list[dict[str, Any]]]]]]:
    sorted_kmers = sorted(kmer_index)
    total_shards = count_shards(sorted_kmers)

    def generator() -> Iterator[tuple[str, dict[str, list[dict[str, Any]]]]]:
        current_shard_key: str | None = None
        current_payload: dict[str, list[dict[str, Any]]] = {}

        for kmer in sorted_kmers:
            matches = kmer_index[kmer]
            if not isinstance(matches, list):
                raise SystemExit(
                    f"Unexpected match list type for {kmer!r}: {type(matches)!r}"
                )

            shard_key = shard_key_for_kmer(kmer)
            if current_shard_key is None:
                current_shard_key = shard_key
            elif shard_key != current_shard_key:
                yield current_shard_key, current_payload
                current_shard_key = shard_key
                current_payload = {}

            current_payload[kmer] = [match_to_json(item, field_names) for item in matches]

        if current_shard_key is not None:
            yield current_shard_key, current_payload

    return total_shards, generator()


def log_write_progress(
    written: int,
    total_shards: int,
    k: int,
    show_live_progress: bool,
    progress_interval: int,
) -> None:
    if show_live_progress:
        print(
            f"\rWritten {written:,}/{total_shards:,} shard files for k={k}...",
            end="",
            flush=True,
        )
        return

    if written == total_shards or written % progress_interval == 0:
        print(f"Written {written:,}/{total_shards:,} shard files for k={k}...")


def write_shards(
    k: int,
    output_target: OutputTarget,
    shards: Iterator[tuple[str, dict[str, list[dict[str, Any]]]]],
    total_shards: int,
    write_workers: int,
) -> None:
    show_live_progress = sys.stdout.isatty()
    progress_interval = max(1, total_shards // 20)

    if write_workers <= 1:
        for written, (shard_key, shard_payload) in enumerate(shards, start=1):
            output_target.write_gzip_json(f"k{k}/{shard_key}.json.gz", shard_payload)
            log_write_progress(
                written=written,
                total_shards=total_shards,
                k=k,
                show_live_progress=show_live_progress,
                progress_interval=progress_interval,
            )

        if show_live_progress:
            print()
        return

    pending: dict[Future[None], str] = {}
    written = 0
    max_pending = write_workers * 2

    with ThreadPoolExecutor(max_workers=write_workers) as executor:
        for shard_key, shard_payload in shards:
            future = executor.submit(
                output_target.write_gzip_json,
                f"k{k}/{shard_key}.json.gz",
                shard_payload,
            )
            pending[future] = shard_key

            if len(pending) < max_pending:
                continue

            done, _ = wait(pending, return_when=FIRST_COMPLETED)
            for completed in done:
                completed.result()
                written += 1
                pending.pop(completed, None)
                log_write_progress(
                    written=written,
                    total_shards=total_shards,
                    k=k,
                    show_live_progress=show_live_progress,
                    progress_interval=progress_interval,
                )

        while pending:
            done, _ = wait(pending, return_when=FIRST_COMPLETED)
            for completed in done:
                completed.result()
                written += 1
                pending.pop(completed, None)
                log_write_progress(
                    written=written,
                    total_shards=total_shards,
                    k=k,
                    show_live_progress=show_live_progress,
                    progress_interval=progress_interval,
                )

    if show_live_progress:
        print()


def load_metadata(source_dir: Path) -> dict[str, Any]:
    metadata_path = source_dir / "index_metadata.pkl"
    if not metadata_path.exists():
        raise SystemExit(f"Missing metadata file: {metadata_path}")

    metadata = load_pickle(metadata_path)
    if not isinstance(metadata, dict):
        raise SystemExit("Metadata file did not contain a dictionary.")

    return metadata


def create_r2_client() -> BaseClient:
    if boto3 is None:
        raise SystemExit(
            "boto3 is required for R2 output. Install it with `python3 -m pip install boto3`."
        )

    endpoint_url = os.environ.get("R2_ENDPOINT_URL")
    if not endpoint_url:
        raise SystemExit("Set R2_ENDPOINT_URL to your Cloudflare R2 S3 endpoint.")

    aws_access_key_id = os.environ.get("AWS_ACCESS_KEY_ID")
    aws_secret_access_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
    if not aws_access_key_id or not aws_secret_access_key:
        raise SystemExit("Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY for R2 uploads.")

    session_token = os.environ.get("AWS_SESSION_TOKEN")
    region_name = os.environ.get("AWS_REGION", "auto")

    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=aws_access_key_id,
        aws_secret_access_key=aws_secret_access_key,
        aws_session_token=session_token,
        region_name=region_name,
    )


def build_output_target(output_value: str, source_dir: Path) -> OutputTarget:
    parsed = urlparse(output_value)
    if parsed.scheme in {"r2", "s3"}:
        bucket = parsed.netloc
        if not bucket:
            raise SystemExit(f"Missing bucket name in output destination: {output_value}")

        prefix = parsed.path.strip("/")
        return R2OutputTarget(bucket=bucket, prefix=prefix, client=create_r2_client())

    output_path = Path(output_value).expanduser()
    if not output_path.is_absolute():
        output_path = (source_dir / output_path).resolve()
    else:
        output_path = output_path.resolve()

    return LocalOutputTarget(output_path)


def convert_k_file(
    source_path: Path,
    output_target: OutputTarget,
    field_names: tuple[str, ...],
    write_workers: int,
) -> None:
    match = FILE_NAME_RE.match(source_path.name)
    if match is None:
        return

    k = int(match.group("k"))
    print(f"Loading {source_path.name}...")
    kmer_index = load_pickle(source_path)

    if not isinstance(kmer_index, dict):
        raise SystemExit(f"Expected dictionary in {source_path.name}.")

    print(f"Loaded {len(kmer_index):,} kmers for k={k}.")
    for kmer in kmer_index:
        if not isinstance(kmer, str):
            raise SystemExit(f"Unexpected kmer key type in {source_path.name}: {type(kmer)!r}")

    total_shards, shards = iter_shards(kmer_index, field_names)
    print(f"Writing {total_shards:,} shard files for k={k}...")
    write_shards(k=k, output_target=output_target, shards=shards, total_shards=total_shards, write_workers=write_workers)
    print(f"Finished k={k}.")


def write_metadata(output_target: OutputTarget, metadata: dict[str, Any]) -> None:
    serializable = {
        **metadata,
        "output_format": {
            "type": "json-gzip-shards",
            "grouping": {
                "top_level_directory": "k{seed_length}",
                "shard_prefix_length": SHARD_PREFIX_LENGTH,
                "filename": "{prefix}.json.gz",
            },
        },
    }

    output_target.write_text("metadata.json", json.dumps(serializable, indent=2))


def main() -> None:
    print("Kmer index converter")
    print("This will convert pickle indexes into gzip-compressed JSON shard files.")

    args = parse_args()
    if args.write_workers < 1:
        raise SystemExit("--write-workers must be at least 1.")

    if args.source_dir:
        source_dir = Path(args.source_dir).expanduser().resolve()
        if not source_dir.exists():
            raise SystemExit(f"Directory does not exist: {source_dir}")
        if not source_dir.is_dir():
            raise SystemExit(f"Path is not a directory: {source_dir}")
    else:
        source_dir = prompt_source_directory()

    metadata = load_metadata(source_dir)

    field_names = tuple(metadata.get("match_fields", ()))
    if not field_names:
        raise SystemExit("Metadata is missing match_fields.")

    default_output = source_dir / "json_shards"
    output_value = args.output or prompt_output_destination(default_output)
    output_target = build_output_target(output_value, source_dir)
    write_metadata(output_target, metadata)

    kmer_files = sorted(
        path for path in source_dir.iterdir() if path.is_file() and FILE_NAME_RE.match(path.name)
    )
    if not kmer_files:
        raise SystemExit(f"No kmer index files found in {source_dir}.")

    print(f"Source directory: {source_dir}")
    print(f"Output destination: {output_target.describe()}")
    print(f"Match fields: {', '.join(field_names)}")

    for source_path in kmer_files:
        convert_k_file(source_path, output_target, field_names, args.write_workers)

    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nCancelled.")
