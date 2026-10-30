import { describe, it, expect } from "vitest";
import { validateReviewSubmission } from "../../../../lib/reviews/validation";
import { getStudentReviewHash } from "../../../../lib/reviews/reviewAuth";

describe("Faculty Reviews API & Validation (Deliverable 4)", () => {
  const validUuid = "11111111-1111-4111-a111-111111111111";

  const validTeachingReview = {
    authorizedID: "25BCE1399",
    faculty_id: validUuid,
    track: "teaching",
    course_code: "BCSE101E",
    semester: "CH20262701",
    answers: {
      T_CLARITY: 5,
      T_DOUBTS: 4,
      T_ALIGN: 4,
      T_FAIR: 5,
      T_REGULAR: 5,
      T_ENGAGE: 4,
      T_MATERIAL: 4,
      T_AGAIN: 5,
      S_PACE: 3,
      S_ATTEND: 3,
      S_MARKS: 4,
      S_WORKLOAD: 2,
      S_PAPER: 3,
    },
    tags_green: ["Explains with examples", "Great for doubts"],
    tags_red: [],
    context: { component: "Theory" },
    grade_bucket: "high",
  };

  it("passes validation for a strictly formatted, valid review", () => {
    const res = validateReviewSubmission(validTeachingReview);
    expect(res.valid).toBe(true);
    expect(res.sanitized?.faculty_id).toBe(validUuid);
    expect(res.sanitized?.course_code).toBe("BCSE101E");
  });

  it("HARD RULE: STRICTLY REJECTS any review containing free-text fields", () => {
    const textAttempt1 = {
      ...validTeachingReview,
      comment: "This professor is great!",
    };
    const res1 = validateReviewSubmission(textAttempt1);
    expect(res1.valid).toBe(false);
    expect(res1.error).toContain("Free-text fields are strictly forbidden");

    const textAttempt2 = {
      ...validTeachingReview,
      review: "Very strict but good notes.",
    };
    const res2 = validateReviewSubmission(textAttempt2);
    expect(res2.valid).toBe(false);
    expect(res2.error).toContain("Free-text fields are strictly forbidden");

    const textAttempt3 = {
      ...validTeachingReview,
      feedback: "Would not recommend.",
    };
    const res3 = validateReviewSubmission(textAttempt3);
    expect(res3.valid).toBe(false);

    const textAttempt4 = {
      ...validTeachingReview,
      notes: "Some private notes",
    };
    const res4 = validateReviewSubmission(textAttempt4);
    expect(res4.valid).toBe(false);
  });

  it("rejects ratings outside the 1 to 5 scale", () => {
    const outOfBounds = {
      ...validTeachingReview,
      answers: {
        ...validTeachingReview.answers,
        T_CLARITY: 6, // Invalid > 5
      },
    };
    const res = validateReviewSubmission(outOfBounds);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("must be an integer between 1 and 5");

    const outOfBoundsZero = {
      ...validTeachingReview,
      answers: {
        ...validTeachingReview.answers,
        T_CLARITY: 0, // Invalid < 1
      },
    };
    const resZero = validateReviewSubmission(outOfBoundsZero);
    expect(resZero.valid).toBe(false);
  });

  it("rejects unrecognized question IDs", () => {
    const invalidKey = {
      ...validTeachingReview,
      answers: {
        ...validTeachingReview.answers,
        UNKNOWN_QUESTION_ID: 5,
      },
    };
    const res = validateReviewSubmission(invalidKey);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Unrecognized question id");
  });

  it("rejects invalid or unapproved tag selections", () => {
    const fakeTag = {
      ...validTeachingReview,
      tags_green: ["Free food in class"], // Not in allowed list
    };
    const res = validateReviewSubmission(fakeTag);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Must be selected from pre-approved options");
  });

  it("rejects exceeding the maximum of 3 green or 3 red tags", () => {
    const tooManyTags = {
      ...validTeachingReview,
      tags_green: [
        "Explains with examples",
        "Shares great notes",
        "Great for doubts",
        "Fair marking", // 4 tags > 3
      ],
    };
    const res = validateReviewSubmission(tooManyTags);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("maximum allowed is 3");
  });

  it("rejects conditional T_LAB question when component is Theory", () => {
    const invalidConditional = {
      ...validTeachingReview,
      context: { component: "Theory" },
      answers: {
        ...validTeachingReview.answers,
        T_LAB: 4, // Not allowed for Theory
      },
    };
    const res = validateReviewSubmission(invalidConditional);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("T_LAB");
  });

  it("requires conditional T_LAB question when component is Lab or Embedded", () => {
    const labReview = {
      ...validTeachingReview,
      context: { component: "Lab" },
      answers: {
        ...validTeachingReview.answers,
        T_LAB: 5,
      },
    };
    const res = validateReviewSubmission(labReview);
    expect(res.valid).toBe(true);
  });

  it("hashes student registration numbers with dedicated secret, never storing raw IDs", () => {
    process.env.REVIEW_HASH_SECRET = "test_review_secret_key_12345";
    const regNo = "25BCE1399";
    const hash1 = getStudentReviewHash(regNo);
    const hash2 = getStudentReviewHash("25bce1399"); // Case insensitive
    expect(hash1).toBe(hash2);
    expect(hash1).not.toContain(regNo);
    expect(hash1.length).toBe(64); // SHA-256 hex
  });
});
