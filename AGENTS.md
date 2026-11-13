# Personal SillyTavern Fork

For any SillyTavern update, Personal Fork change, BaiBao Tools / BaiBaoKu update,
or selected Shalistera improvement, first read
[docs/personal-fork/MAINTENANCE_COMPATIBILITY.md](docs/personal-fork/MAINTENANCE_COMPATIBILITY.md)
and perform Capability Ownership Review before editing. Read
[PRODUCTION_BASELINE.json](docs/personal-fork/PRODUCTION_BASELINE.json) for the actual deployed combination and
[PERSONAL_RELEASE_OPERATIONS.md](docs/personal-fork/PERSONAL_RELEASE_OPERATIONS.md) for release/deploy/rollback boundaries.

Check all three repositories as an integrated triad when updating any one of them;
never blindly copy or auto-merge upstream or companion updates without comparing
cross-repo consistency and designing the integration plan first. Prefer stability over
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
provided production evidence; pending backup, security review and cleanup are
separate tasks. The fnOS Compose GUI update path is confirmed in PERSONAL_RELEASE_OPERATIONS.md.
Never update companion plugins implicitly.

For companion deployment details, read the [ST-BaiBai-Tools runbook](https://github.com/SurgeXW0508/ST-BaiBai-Tools/blob/personal/stable/docs/PERSONAL_MAINTENANCE.md)
and the [BaiBaoKu runbook](https://github.com/SurgeXW0508/baibaoku/blob/personal/stable/docs/PERSONAL_MAINTENANCE.md).

Provide a NAS deployment handoff only at **major phase or major feature completion
milestones** (when a complete stage is ready to evaluate for deployment, or when the
user asks about deployment): state whether the change affects NAS Runtime, whether it
has reached the correct production branch/release, identify the exact current and
target commit or image Digest, and ask whether the user wants to update NAS now. Give
the component-specific procedure from the runbooks: ST uses fnOS Compose with the
immutable GHCR Digest; Tools uses the SillyTavern Extension Manager; BaiBaoKu uses the
targeted Git update in the fnOS Docker container terminal followed by a GUI container
restart. Skip this boilerplate during intermediate sub-steps, candidate iterations, or
multi-part discussions where deployment is explicitly deferred. Never publish, update,
restart, or modify production data without explicit user authorization.
