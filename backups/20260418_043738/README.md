# Pistachio Production Data Backup

**Backup Date:** 2026-04-18 04:37:39 UTC  
**Backup Type:** incremental  
**Total Size:** 20K  

## Contents

- `data/` - Raw data files
- `data-backup.tar.gz` - Compressed backup archive
- `metadata.json` - Backup metadata and statistics
- `checksums.txt` - File integrity checksums

## Statistics

- Productions: 7 records
- Materials: 24 transactions
- Files: 2 JSON files

## Restoration

To restore this backup:

1. Extract the archive: `tar -xzf data-backup.tar.gz`
2. Verify checksums: `sha256sum -c checksums.txt`
3. Replace your data directory with the extracted files

## Verification

All JSON files have been validated for syntax correctness.
Checksums are provided for integrity verification.
