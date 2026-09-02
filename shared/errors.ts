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
  DUPLICATE_CROSSWORD_VERTICAL: "Bạn đã dùng lượt giải hàng dọc của ô chữ này.",
  LATE_ANSWER: "Đã hết thời gian trả lời.",
  NOT_ELIGIBLE: "Bạn sẽ bắt đầu từ câu tiếp theo.",
  RATE_LIMITED: "Thao tác quá nhanh. Vui lòng thử lại sau.",
  SCRIPTURE_DISABLED: "Tính năng tra cứu Kinh Thánh chưa được bật.",
  SCRIPTURE_VERSION_UNAVAILABLE: "Bản dịch Kinh Thánh này hiện không khả dụng.",
  SCRIPTURE_REFERENCE_INVALID: "Phân đoạn Kinh Thánh không hợp lệ.",
  SCRIPTURE_LICENSE_UNAVAILABLE: "Bản dịch này chưa được cấp quyền cho ứng dụng.",
  SCRIPTURE_PROVIDER_RATE_LIMITED:
    "Dịch vụ Kinh Thánh đang giới hạn yêu cầu. Vui lòng thử lại sau.",
  QUESTION_GENERATION_RATE_LIMITED: "Đã đạt giới hạn tạo câu hỏi. Vui lòng thử lại sau.",
  QUESTION_GENERATION_UNAVAILABLE: "Không thể tạo câu hỏi lúc này.",
  NO_VALID_CANDIDATES: "Không có câu hỏi đề xuất nào vượt qua kiểm tra.",
  QUESTION_MEDIA_INVALID: "Tệp hình ảnh hoặc âm thanh không hợp lệ.",
  QUESTION_MEDIA_EXPIRED: "Tệp hình ảnh hoặc âm thanh đã hết hạn.",
  QUESTION_MEDIA_UNSAFE: "Tệp hình ảnh hoặc âm thanh không vượt qua kiểm tra an toàn.",
  QUESTION_MEDIA_RIGHTS_REQUIRED: "Cần xác nhận quyền sử dụng tệp này.",
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
    public readonly retryAfterSec?: number,
  ) {
    super(message);
  }
}

export function errorResponse(
  code: ErrorCode,
  status: number,
  headers?: HeadersInit,
  retryAfterSec?: number,
): Response {
  return Response.json(
    {
      error: {
        code,
        message: ERROR_MESSAGES[code],
        ...(retryAfterSec ? { retryAfterSec } : {}),
      },
    },
    { status, headers },
  );
}
