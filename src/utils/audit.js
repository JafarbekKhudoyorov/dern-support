import AuditLog from "../models/audit-log.js"

export const createAuditLog = async (logData, req) => {
  try {
    const auditLog = new AuditLog({
      user: logData.userId,
      action: logData.action,
      resource: logData.resourceType,
      resourceType: logData.resourceType,
      resourceId: logData.resourceId,
      details: logData.details,
      changes: logData.changes,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.get("User-Agent"),
    })

    await auditLog.save()
    return auditLog
  } catch (err) {
    console.error("Error creating audit log:", err)
    // Don't throw error to avoid breaking the main operation
  }
}

export const getAuditTrail = async (resourceType, resourceId, limit = 50) => {
  try {
    return await AuditLog.find({
      resource: resourceType,
      resourceId,
    })
      .populate("user", "username email")
      .sort({ timestamp: -1 })
      .limit(limit)
  } catch (err) {
    console.error("Error fetching audit trail:", err)
    return []
  }
}
