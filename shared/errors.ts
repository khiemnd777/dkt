export const ERROR_MESSAGES = {
  BAD_REQUEST: "Yêu cầu không hợp lệ.",
  BODY_TOO_LARGE: "Dữ liệu gửi lên quá lớn.",
  CONTENT_TYPE_REQUIRED: "Yêu cầu phải dùng định dạng JSON.",
  ROOM_NOT_FOUND: "Không tìm thấy phòng chơi.",
  ROOM_COLLISION: "Mã phòng đã được sử dụng.",
  ROOM_FULL: "Phòng chơi đã đủ người.",
  ROOM_CLOSED: "Phòng chơi không còn nhận người mới.",
  UNAUTHORIZED: "Phiên truy cập không hợp lệ.",
  INVALID_TICKET: "Vé kết nối không hợp lệ hoặc đã hết hạn.",
  INVALID_PHASE: "Thao tác này chưa thể thực hiện lúc này.",
  DUPLICATE_ANSWER: "Bạn đã trả lời câu này.",
  LATE_ANSWER: "Đã hết thời gian trả lời.",
  NOT_ELIGIBLE: "Bạn sẽ bắt đầu từ câu tiếp theo.",
  RATE_LIMITED: "Thao tác quá nhanh. Vui lòng thử lại sau.",
  PLATFORM_UNAVAILABLE:
    "Hệ thống tạm thời đã đạt giới hạn sử dụng miễn phí hoặc đang quá tải. Vui lòng thử lại sau.",
  INTERNAL_ERROR: "Đã xảy ra lỗi. Vui lòng thử lại.",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string = ERROR_MESSAGES[code],
  ) {
    super(message);
  }
}

export function errorResponse(code: ErrorCode, status: number, headers?: HeadersInit): Response {
  return Response.json({ error: { code, message: ERROR_MESSAGES[code] } }, { status, headers });
}
