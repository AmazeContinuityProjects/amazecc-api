type AssessmentLike = Record<string, unknown> & {
  maxMark?: unknown;
  scoredMark?: unknown;
  weightagePercent?: unknown;
  weightageMark?: unknown;
  title?: unknown;
};

type CourseLike = Record<string, unknown> & {
  credits?: unknown;
  courseType?: unknown;
  courseCode?: unknown;
  classNbr?: unknown;
  assessments?: unknown[];
};

type MarksDataLike = {
  courses?: unknown[];
};

type CourseGroup = {
  theory?: CourseLike | null;
  lab?: CourseLike | null;
};

type SyncAction = {
  type: 'add' | 'update';
  classId: string;
  assessmentTitle: string;
  mark: number;
  oldMark?: number;
};

const getNumericValue = (value: unknown, fallback = 0): number => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

type Totals = { max: number; scored: number; weightPercent: number; weighted: number };
const getAssessmentTotals = (assessments: Record<string, unknown>[]): Totals => {
  return assessments.reduce<Totals>(
    (acc, asm) => {
      const rec = asm as AssessmentLike;
      acc.max += getNumericValue(rec.maxMark);
      acc.scored += getNumericValue(rec.scoredMark);
      acc.weightPercent += getNumericValue(rec.weightagePercent);
      acc.weighted += getNumericValue(rec.weightageMark);
      return acc;
    },
    { max: 0, scored: 0, weightPercent: 0, weighted: 0 }
  );
};

const getCourseCredits = (course: Record<string, unknown> | null | undefined): number => {
  const credits = getNumericValue((course as CourseLike | null | undefined)?.credits, -1);
  return credits > 0 ? credits : -1;
};

const getCourseStats = (group: CourseGroup) => {
  const theoryAssessments = (group.theory?.assessments ?? []) as Record<string, unknown>[];
  const labAssessments = (group.lab?.assessments ?? []) as Record<string, unknown>[];
  const theoryTotals = getAssessmentTotals(theoryAssessments);
  const labTotals = getAssessmentTotals(labAssessments);
  
  if (!group.lab) {
    const projected = theoryTotals.weightPercent > 0 ? Math.round((theoryTotals.weighted / theoryTotals.weightPercent) * 100) : 0;
    return { projected };
  }
  
  if (!group.theory) {
    const projected = labTotals.weightPercent > 0 ? Math.round((labTotals.weighted / labTotals.weightPercent) * 100) : 0;
    return { projected };
  }
  
  const theoryCredits = getCourseCredits(group.theory as unknown as Record<string, unknown>);
  const labCredits = getCourseCredits(group.lab as unknown as Record<string, unknown>);
  
  if (theoryCredits < 0 || labCredits < 0) {
    return { projected: 0 };
  }
  
  const creditsTotal = theoryCredits + labCredits;
  const combinedWeighted = (theoryCredits * theoryTotals.weighted + labCredits * labTotals.weighted) / creditsTotal;
  const combinedWeightPercent = (theoryCredits * theoryTotals.weightPercent + labCredits * labTotals.weightPercent) / creditsTotal;
  
  const projected = combinedWeightPercent > 0 ? Math.round((combinedWeighted / combinedWeightPercent) * 100) : 0;
  
  return { projected };
};

const hashString = async (str: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const syncMarksDiff = async (oldMarksData: unknown, newMarksData: unknown, username: string) => {
    const newData = newMarksData as MarksDataLike | null | undefined;
    if (!username || !newData?.courses) return;

    try {
        let mutableOldMarksData: unknown = oldMarksData;
        const hasSyncedBefore = localStorage.getItem("hasSyncedMarksV2");
        if (!hasSyncedBefore) {
            mutableOldMarksData = {};
        }

        const buildMap = (marksData: unknown) => {
            const map = new Map<string, CourseGroup & { courseCode: string }>();
            if (!marksData || typeof marksData !== "object") return map;
            const maybeCourses = (marksData as MarksDataLike).courses;
            if (!Array.isArray(maybeCourses)) return map;
            maybeCourses.forEach((c: unknown) => {
                const course = c as CourseLike;
                const courseTypeStr = String(course.courseType ?? "").toLowerCase();
                const isLab = courseTypeStr.includes("lab");
                const code = String(course.courseCode ?? "");
                if (!code) return;
                if (!map.has(code)) {
                    map.set(code, {
                        courseCode: code,
                        theory: !isLab ? course : null,
                        lab: isLab ? course : null,
                    });
                } else {
                    const existing = map.get(code);
                    if (!existing) return;
                    if (isLab) existing.lab = course;
                    else existing.theory = course;
                }
            });
            return map;
        };

        const oldMap = buildMap(mutableOldMarksData);
        const newMap = buildMap(newMarksData);
        const actions: SyncAction[] = [];

        newMap.forEach((newGroup, courseCode) => {
            const oldGroup: CourseGroup = oldMap.get(courseCode) || {};
            const mainCourse = newGroup.theory || newGroup.lab;
            const classId = String((mainCourse as CourseLike)?.classNbr ?? "");

            const oldStats = oldGroup.theory || oldGroup.lab ? getCourseStats(oldGroup) : { projected: undefined as unknown as number };
            const newStats = getCourseStats(newGroup);

            if (newStats.projected > 0) {
                if (oldStats.projected === undefined || oldStats.projected === 0) {
                    actions.push({ type: 'add', classId, assessmentTitle: 'OVERALL', mark: newStats.projected });
                } else if (oldStats.projected !== newStats.projected) {
                    actions.push({ type: 'update', classId, assessmentTitle: 'OVERALL', oldMark: oldStats.projected, mark: newStats.projected });
                }
            }

            const checkAssessments = (oldAsms: Record<string, unknown>[] = [], newAsms: Record<string, unknown>[] = []) => {
                const oldAsmMap = new Map<string, Record<string, unknown>>(oldAsms.map(a => [String((a as AssessmentLike).title ?? ""), a]));
                newAsms.forEach((newAsmRaw) => {
                    const newAsm = newAsmRaw as AssessmentLike;
                    const newPct = getNumericValue(newAsm.maxMark) > 0 ? (getNumericValue(newAsm.scoredMark) / getNumericValue(newAsm.maxMark)) * 100 : 0;
                    if (newPct > 0) {
                        const oldAsm = oldAsmMap.get(String(newAsm.title ?? "")) as AssessmentLike | undefined;
                        if (!oldAsm) {
                            actions.push({ type: 'add', classId, assessmentTitle: String(newAsm.title ?? ""), mark: newPct });
                        } else {
                            const oldPct = getNumericValue(oldAsm.maxMark) > 0 ? (getNumericValue(oldAsm.scoredMark) / getNumericValue(oldAsm.maxMark)) * 100 : 0;
                            if (oldPct !== newPct) {
                                actions.push({ type: 'update', classId, assessmentTitle: String(newAsm.title ?? ""), oldMark: oldPct, mark: newPct });
                            }
                        }
                    }
                });
            };

            const oldTheoryAsms = (oldGroup.theory?.assessments ?? []) as Record<string, unknown>[];
            const oldLabAsms = (oldGroup.lab?.assessments ?? []) as Record<string, unknown>[];
            const newTheoryAsms = (newGroup.theory?.assessments ?? []) as Record<string, unknown>[];
            const newLabAsms = (newGroup.lab?.assessments ?? []) as Record<string, unknown>[];

            checkAssessments(oldTheoryAsms, newTheoryAsms);
            checkAssessments(oldLabAsms, newLabAsms);
        });

        if (actions.length > 0) {
            const userHash = await hashString(username);
            const res = await fetch('/api/marks/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    actions,
                    userHash,
                    timestamp: Date.now()
                })
            });
            if (res.ok) {
                localStorage.setItem("hasSyncedMarksV2", "true");
            }
        } else if (!hasSyncedBefore) {
            // Even if actions is 0 (somehow no courses), mark as synced so we don't keep trying
            localStorage.setItem("hasSyncedMarksV2", "true");
        }
    } catch (e) {
        console.error("Error during background sync:", e);
    }
};
