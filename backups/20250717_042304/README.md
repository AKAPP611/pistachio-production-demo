# Pistachio Production Data Backup

**Backup Date:** 2025-07-17 04:23:04 UTC  
**Backup Type:** incremental  
**Total Size:** 12K  

## Contents

- `data/` - Raw data files
- `data-backup.tar.gz` - Compressed backup archive
- `metadata.json` - Backup metadata and statistics
- `checksums.txt` - File integrity checksums

## Statistics

- Productions: 2 records
- Materials: 9 transactions
- Files: 2 JSON files

## Restoration

To restore this backup:

1. Extract the archive: `tar -xzf data-backup.tar.gz`
2. Verify checksums: `sha256sum -c checksums.txt`
3. Replace your data directory with the extracted files

## Verification

All JSON files have been validated for syntax correctness.
Checksums are provided for integrity verification.
