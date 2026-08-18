import { describe, it, expect } from "vitest";
import { segmentQuestions } from "./ocr";

describe("segmentQuestions", () => {
  const sample = [
    `VIT CHENNAI
B.Tech Computer Science
Time: 3 Hours    Max. Marks: 100

PART A

1. What is the time complexity of QuickSort in the worst case? (2 Marks)
   a) O(n log n)
   b) O(n^2)
   c) O(n)
   d) O(1)

2. Solve for x: dy/dx = e^(2x) sin x. (5)

3. A particle moves in a circle of radius 2m with speed v = 4t^2. Find the tangential acceleration at t = 1s. (10 Marks)

4. OR

5. Define data structure. (2 Marks)
`,
  ];

  const qs = segmentQuestions(sample);

  it("extracts 4 questions", () => {
    expect(qs.length).toBe(4);
  });

  it("detects MCQ with options", () => {
    const mcq = qs[0];
    expect(mcq.question_type).toBe("MCQ");
    expect(mcq.options?.A).toBe("O(n log n)");
    expect(mcq.marks).toBe(2);
  });

  it("detects numerical questions", () => {
    const numeric = qs.find((q) => q.question_number === "2");
    expect(numeric?.question_type).toBe("NUMERICAL");
    expect(numeric?.marks).toBe(5);
  });

  it("parses trailing marks", () => {
    const q3 = qs.find((q) => q.question_number === "3");
    expect(q3?.marks).toBe(10);
  });

  it("assigns numbers correctly", () => {
    expect(qs.map((q) => q.question_number)).toEqual(["1", "2", "3", "5"]);
  });
});
