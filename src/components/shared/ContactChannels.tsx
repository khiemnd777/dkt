import { CONTACT_CHANNELS } from "@shared/contact";
import { MessageCircleMore } from "lucide-react";

export function ContactChannels() {
  return (
    <section className="contact-channels" aria-labelledby="contact-heading">
      <div className="contact-heading">
        <MessageCircleMore aria-hidden="true" />
        <div>
          <strong id="contact-heading">Có góp ý cho Đố Kinh Thánh Live?</strong>
          <span>Nhắn cho mình qua kênh thuận tiện nhất.</span>
        </div>
      </div>
      <nav className="contact-links" aria-label="Kênh liên hệ và góp ý">
        {CONTACT_CHANNELS.map((channel) => {
          const opensWebsite = channel.href.startsWith("https://");
          return (
            <a
              key={channel.id}
              href={channel.href}
              aria-label={`${channel.label}: ${channel.handle}`}
              {...(opensWebsite ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {channel.label}
            </a>
          );
        })}
      </nav>
      <small>Không gửi mã phòng, token hoặc nội dung riêng tư của người chơi.</small>
    </section>
  );
}
