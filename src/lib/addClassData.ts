import { getDbPool } from './db';

export interface IClassStatistics {
    mean: number;
    variance: number;
    sd: number;
    count: number;
}

function getStatistics(data: { count: number; mean: number; m2: number }): IClassStatistics {
    const variance = data.count > 0 ? data.m2 / data.count : 0;

    return {
        mean: data.mean,
        variance,
        sd: Math.sqrt(variance),
        count: data.count,
    };
}

export default async function AddClassData(classID: string, userId: string, marks: number) {
    if (!classID.trim()) {
        throw new Error('classID is required.');
    }

    if (!userId.trim()) {
        throw new Error('userId is required.');
    }

    if (!Number.isFinite(marks)) {
        throw new Error('marks must be a finite number.');
    }

    try {
        const pool = getDbPool();

        // 1. Check if class data exists
        const res = await pool.query(`SELECT * FROM class_data WHERE class_id = $1`, [classID]);
        
        if (res.rows.length === 0) {
            // Create new
            const newClassData = {
                count: 1,
                mean: marks,
                m2: 0,
            };
            
            await pool.query(
                `INSERT INTO class_data (class_id, includes_users, count, mean, m2) VALUES ($1, $2, $3, $4, $5)`,
                [classID, JSON.stringify([userId]), newClassData.count, newClassData.mean, newClassData.m2]
            );

            return getStatistics(newClassData);
        }

        const existingClassData = res.rows[0];
        const includesUsers = existingClassData.includes_users || [];
        
        // Prevent duplicate users from mutating class statistics.
        if (includesUsers.includes(userId)) {
            return getStatistics({
                count: existingClassData.count,
                mean: existingClassData.mean,
                m2: existingClassData.m2
            });
        }

        const oldCount = Number(existingClassData.count);
        const newCount = oldCount + 1;

        // Welford's online update keeps running mean/variance numerically stable.
        const existingMean = Number(existingClassData.mean);
        const existingM2 = Number(existingClassData.m2);
        
        const delta = marks - existingMean;
        const updatedMean = existingMean + delta / newCount;
        const delta2 = marks - updatedMean;
        const updatedM2 = existingM2 + delta * delta2;

        includesUsers.push(userId);

        await pool.query(
            `UPDATE class_data SET includes_users = $1, count = $2, mean = $3, m2 = $4 WHERE class_id = $5`,
            [JSON.stringify(includesUsers), newCount, updatedMean, updatedM2, classID]
        );

    } catch (error) {
        throw new Error(
            `Failed to add class data for classID "${classID}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

export const fetchClassStatistics = async (classID: string): Promise<IClassStatistics> => {
    if (!classID.trim()) {
        throw new Error('classID is required.');
    }
    try {
        const pool = getDbPool();
        const res = await pool.query(`SELECT * FROM class_data WHERE class_id = $1`, [classID]);

        if (res.rows.length === 0) {
            throw new Error(`No data found for classID "${classID}".`);
        }
        
        return getStatistics({
            count: Number(res.rows[0].count),
            mean: Number(res.rows[0].mean),
            m2: Number(res.rows[0].m2)
        });
    } catch (error) {
        throw new Error(
            `Failed to fetch class statistics for classID "${classID}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
};
