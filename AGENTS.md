# Personal SillyTavern Fork

For any SillyTavern update, Personal Fork change, BaiBao Tools / BaiBaoKu update,
or selected Shalistera improvement, first read
[docs/personal-fork/MAINTENANCE_COMPATIBILITY.md](docs/personal-fork/MAINTENANCE_COMPATIBILITY.md)
and perform Capability Ownership Review before editing. Read
[PRODUCTION_BASELINE.json](docs/personal-fork/PRODUCTION_BASELINE.json) for the actual deployed combination and
[PERSONAL_RELEASE_OPERATIONS.md](docs/personal-fork/PERSONAL_RELEASE_OPERATIONS.md) for release/deploy/rollback boundaries.

Check all three repositories when updating any one of them. Prefer stability over
feature completeness, one capability owner, native functionality, and deleting redundant
implementations. Save Generate is disabled in the validated personal combination;
do not restore the removed Vertex plugin contract or recovery adapters.

Use upstream/release for the unmodified official synchronization baseline.
release contains the reviewed Personal stable version; develop on an independent
branch. Read personal-release.json and the Validated Stack before an update.
Merging, tagging, releasing, and deployment require task authorization.
Do not modify production data or vendor third-party plugin code into this repository.
Update the canonical ownership/decision record and run affected checks before
proposing an upgrade. Other repositories must link to that document rather than
maintain competing compatibility matrices.

Keep Candidate, formal-image acceptance, and repository HEAD distinct. Record only
provided production evidence; pending backup, GUI, security review and cleanup are
separate tasks. Never update companion plugins implicitly.
