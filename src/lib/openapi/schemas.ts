/**
 * Shared OpenAPI components, picked up by swagger-jsdoc (see src/lib/swagger.ts).
 *
 * Route files reference these with `$ref: '#/components/schemas/<Name>'` so
 * the spec describes real response bodies. Keep them in step with the TS
 * types in src/types/data; they are what a generated client would use.
 *
 * @openapi
 * components:
 *   schemas:
 *     VtopSession:
 *       type: object
 *       description: The session returned by /api/login, sent back on every VTOP-backed route.
 *       required: [cookies, authorizedID, csrf]
 *       properties:
 *         cookies:
 *           oneOf:
 *             - type: array
 *               items: { type: string }
 *             - type: string
 *           description: VTOP session cookies, as an array or a single "; "-joined header.
 *         authorizedID:
 *           type: string
 *           description: The student's VTOP id (usually the register number).
 *         csrf:
 *           type: string
 *     LoginRequest:
 *       type: object
 *       required: [username, password]
 *       properties:
 *         username: { type: string, description: VTOP username (register number) }
 *         password: { type: string, format: password }
 *     LoginSuccess:
 *       type: object
 *       required: [success, cookies, csrf, authorizedID]
 *       properties:
 *         success: { type: boolean, enum: [true] }
 *         message: { type: string }
 *         cookies:
 *           type: array
 *           items: { type: string }
 *         csrf: { type: string }
 *         authorizedID: { type: string }
 *         clubToken:
 *           type: string
 *           description: Present only for club representatives.
 *         clubRoles:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               club_id: { type: string }
 *               role: { type: string }
 *     ErrorMessage:
 *       type: object
 *       properties:
 *         success: { type: boolean, enum: [false] }
 *         message: { type: string }
 *         error: { type: string }
 *     AttendanceDay:
 *       type: object
 *       properties:
 *         date: { type: string, example: 02-Jul-2026 }
 *         status: { type: string, example: Present }
 *     AttendanceItem:
 *       type: object
 *       description: One course row (src/types/data/attendance.ts `attendanceItem`).
 *       required: [courseCode, courseTitle, slotName]
 *       properties:
 *         slNo: { type: string, nullable: true }
 *         courseCode: { type: string, example: BCSE101E }
 *         courseTitle: { type: string }
 *         courseType: { type: string, nullable: true }
 *         slotName: { type: string, example: A1+TA1 }
 *         faculty: { type: string, nullable: true }
 *         registrationDate: { type: string, nullable: true }
 *         attendanceDate: { type: string, nullable: true }
 *         attendedClasses: { type: integer, nullable: true }
 *         totalClasses: { type: integer, nullable: true }
 *         attendancePercentage: { type: string, nullable: true }
 *         viewLink:
 *           nullable: true
 *           oneOf:
 *             - type: string
 *             - type: array
 *               items: { $ref: '#/components/schemas/AttendanceDay' }
 *           description: Day-wise records once the detail page has been fetched.
 *         slotVenue: { type: string, nullable: true }
 *         classId: { type: string, nullable: true }
 *         credits: { type: string, nullable: true }
 *         category: { type: string, nullable: true }
 *     AttendanceResponse:
 *       type: object
 *       required: [attRes]
 *       properties:
 *         attRes:
 *           type: object
 *           properties:
 *             semester: { type: string, example: CH20262705 }
 *             attendance:
 *               type: array
 *               items: { $ref: '#/components/schemas/AttendanceItem' }
 *         marksRes:
 *           type: object
 *           description: Marks payload fetched alongside attendance.
 */
export {};
