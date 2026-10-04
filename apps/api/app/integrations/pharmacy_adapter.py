"""Mock adapter boundary for future pharmacy integrations."""


class PharmacyAdapter:
    async def retrieve_medications(self, patient_reference: str) -> None:
        raise NotImplementedError("Pharmacy integration is intentionally not enabled in Phase 0")
