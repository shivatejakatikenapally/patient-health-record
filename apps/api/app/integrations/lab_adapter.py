"""Mock adapter boundary for future laboratory integrations."""


class LabAdapter:
    async def retrieve_results(self, patient_reference: str) -> None:
        raise NotImplementedError("Lab integration is intentionally not enabled in Phase 0")
