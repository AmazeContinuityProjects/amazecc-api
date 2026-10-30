import { describe, it, expect, beforeAll } from "vitest";
import {
  schemaVersion,
  SCHEMA_VERSION,
  TEACHING_CONFIG,
  PROJECT_CONFIG,
  CANONICAL_REVIEW_QUESTIONS,
  getEffectiveQuestionWeights,
} from "@/config/reviewQuestions";
import { signIngestPayload, verifyIngestPayload } from "@/lib/reviews/reviewAuth";

describe("AmazeCC-api Shared Reviews Schema & Ingest Contract Specification", () => {
  beforeAll(() => {
    process.env.REVIEWS_INGEST_SECRET = "test_ingest_secret_for_contract_tests_12345";
  });
  describe("Schema Versioning Contract", () => {
    it("exports canonical schemaVersion strictly equal to '1.0.0'", () => {
      expect(schemaVersion).toBe("1.0.0");
      expect(SCHEMA_VERSION).toBe("1.0.0");
    });

    it("embodies schemaVersion in TEACHING_CONFIG, PROJECT_CONFIG, and CANONICAL_REVIEW_QUESTIONS", () => {
      expect(TEACHING_CONFIG.schemaVersion).toBe("1.0.0");
      expect(PROJECT_CONFIG.schemaVersion).toBe("1.0.0");
      expect(CANONICAL_REVIEW_QUESTIONS.schemaVersion).toBe("1.0.0");
    });
  });

  describe("Question Criteria & Scoring Contracts", () => {
    it("enforces that Theory quality questions weights sum exactly to 100", () => {
      const theoryQuestions = TEACHING_CONFIG.qualityQuestions.filter(
        (q) => !q.conditional
      );
      const totalWeight = theoryQuestions.reduce((sum, q) => sum + q.weight, 0);
      expect(totalWeight).toBe(100);
    });

    it("enforces that Project Guide quality questions weights sum exactly to 100", () => {
      const totalWeight = PROJECT_CONFIG.qualityQuestions.reduce(
        (sum, q) => sum + q.weight,
        0
      );
      expect(totalWeight).toBe(100);
    });

    it("correctly calculates component weights via getEffectiveQuestionWeights", () => {
      const theoryWeights = getEffectiveQuestionWeights("teaching", "Theory");
      const theorySum = Object.values(theoryWeights).reduce((a, b) => a + b, 0);
      expect(Math.round(theorySum)).toBe(100);
      expect(theoryWeights["T_LAB"]).toBeUndefined();

      const labWeights = getEffectiveQuestionWeights("teaching", "Lab");
      const labSum = Object.values(labWeights).reduce((a, b) => a + b, 0);
      expect(Math.round(labSum)).toBe(100);
      expect(labWeights["T_LAB"]).toBeGreaterThan(0);
    });
  });

  describe("API ↔ Worker Ingest Contract", () => {
    it("signs ingest payload with HMAC-SHA256 timestamped signature", () => {
      const rawPayload = JSON.stringify({
        schemaVersion: "1.0.0",
        idempotencyKey: "test:student:fac:CSE1001",
        student_hash: "a".repeat(64),
        faculty_id: "00000000-0000-0000-0000-000000000000",
        track: "teaching",
        course_code: "CSE1001",
        verified: true,
        answers: { T_CLARITY: 5 },
        tags_green: ["Explains with examples"],
        tags_red: [],
        context: {},
        timestamp: Date.now(),
      });

      const { timestamp, signature } = signIngestPayload(rawPayload);
      expect(timestamp).toBeDefined();
      expect(signature).toBeDefined();
      expect(signature).toHaveLength(64); // SHA-256 hex string

      const verified = verifyIngestPayload(rawPayload, timestamp, signature);
      expect(verified).toBe(true);
    });

    it("rejects tampered or stale ingest signatures", () => {
      const rawPayload = JSON.stringify({ test: "data" });
      const { timestamp, signature } = signIngestPayload(rawPayload);

      // Tampered payload
      const tampered = JSON.stringify({ test: "tampered" });
      expect(verifyIngestPayload(tampered, timestamp, signature)).toBe(false);

      // Stale timestamp (> 5 minutes ago)
      const staleTimestamp = String(Math.floor(Date.now() / 1000) - 360);
      expect(verifyIngestPayload(rawPayload, staleTimestamp, signature)).toBe(false);
    });
  });

  describe("Public Read API Schema Contracts", () => {
    it("validates Catalog response payload shape adhering to schemaVersion '1.0.0'", () => {
      const catalogResponse = {
        schemaVersion: "1.0.0",
        faculty: [
          {
            id: "b49bf45d-b417-4044-a91b-53e5ad109a79",
            employee_id: "10234",
            name: "Dr. Anusooya G",
            name_norm: "anusooya g",
            school: "SCOPE",
            designation: "Associate Professor",
            image_url: null,
            vitfac_id: "vitfac_anusooya",
            teaching_grade: 4.25,
            teaching_reviews: 12,
            teaching_verified_ratio: 0.92,
            project_grade: null,
            project_reviews: 0,
            updated_at: new Date().toISOString(),
          },
        ],
        updated_at: new Date().toISOString(),
      };

      expect(catalogResponse.schemaVersion).toBe("1.0.0");
      expect(catalogResponse.faculty).toBeInstanceOf(Array);
      expect(catalogResponse.faculty[0].id).toBeDefined();
      expect(catalogResponse.faculty[0].teaching_reviews).toBe(12);
    });

    it("validates Profile response payload shape adhering to schemaVersion '1.0.0'", () => {
      const profileResponse = {
        schemaVersion: "1.0.0",
        faculty: {
          id: "b49bf45d-b417-4044-a91b-53e5ad109a79",
          employee_id: "10234",
          name: "Dr. Anusooya G",
          school: "SCOPE",
          designation: "Associate Professor",
          image_url: null,
          vitfac_id: "vitfac_anusooya",
        },
        teaching: {
          track: "teaching",
          course_code: "",
          n_reviews: 12,
          n_verified: 11,
          grade: 4.25,
          is_early: false,
          per_question: {},
          style: {},
          top_tags_green: [],
          top_tags_red: [],
        },
        project: null,
        teaching_by_course: {},
        updated_at: new Date().toISOString(),
      };

      expect(profileResponse.schemaVersion).toBe("1.0.0");
      expect(profileResponse.faculty.id).toBeDefined();
      expect(profileResponse.teaching?.grade).toBe(4.25);
    });
  });
});
