"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { compressImage, dataUrlToFile } from "@/app/lib/image-files";

type SupportStatus = "open" | "in_progress" | "resolved";

type Conversation = {
  id: string;
  subject: string;
  status: SupportStatus;
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    displayName: string | null;
  };
};

type SupportMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderRole: "user" | "admin";
  senderName: string | null;
  body: string;
  createdAt: string;
  attachments: Array<{
    id: string;
    contentType: string;
    originalFilename: string | null;
    sizeBytes: number;
  }>;
};

const STATUS_LABEL: Record<SupportStatus, string> = {
  open: "รอแอดมินตอบ",
  in_progress: "กำลังดูแล",
  resolved: "แก้ไขแล้ว",
};

const EMPTY_IMAGE_URLS: string[] = [];

function statusClass(status: SupportStatus) {
  if (status === "resolved") return "bg-emerald-300/15 text-emerald-200";
  if (status === "in_progress") return "bg-sky-300/15 text-sky-200";
  return "bg-amber-300/15 text-amber-200";
}

export function SupportChatWorkspace({
  mode,
  compact = false,
  defaultNewConversation = false,
  draftImageUrls = EMPTY_IMAGE_URLS,
}: {
  mode: "user" | "admin";
  compact?: boolean;
  defaultNewConversation?: boolean;
  draftImageUrls?: string[];
}) {
  const isAdmin = mode === "admin";
  const listEndpoint = isAdmin
    ? "/api/admin/support/conversations"
    : "/api/support/conversations";
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [newConversation, setNewConversation] = useState(defaultNewConversation);
  const [subject, setSubject] = useState(
    defaultNewConversation ? "ขอให้ทีมงานช่วยแก้ภาพที่เจน" : ""
  );
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const threadEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(listEndpoint, { cache: "no-store" });
      const data = await response.json();
      if (response.status === 403 && !isAdmin) {
        setAccessDenied(true);
        setConversations([]);
        return;
      }
      if (!response.ok) throw new Error(data.error || "โหลดรายการไม่สำเร็จ");

      const nextConversations: Conversation[] = data.conversations || [];
      setConversations(nextConversations);
      setSelectedId((current) => {
        if (current && nextConversations.some((item) => item.id === current)) return current;
        return nextConversations[0]?.id || null;
      });
      setAccessDenied(false);
    } catch (error) {
      if (!silent) setNotice(error instanceof Error ? error.message : "โหลดรายการไม่สำเร็จ");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isAdmin, listEndpoint]);

  const loadMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!silent) setThreadLoading(true);
    const endpoint = isAdmin
      ? `/api/admin/support/conversations/${conversationId}/messages`
      : `/api/support/conversations/${conversationId}/messages`;

    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "โหลดข้อความไม่สำเร็จ");
      setMessages(data.messages || []);
    } catch (error) {
      if (!silent) setNotice(error instanceof Error ? error.message : "โหลดข้อความไม่สำเร็จ");
    } finally {
      if (!silent) setThreadLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadConversations(), 0);
    const interval = window.setInterval(() => void loadConversations(true), 15_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId || newConversation) return;
    const initialLoad = window.setTimeout(() => void loadMessages(selectedId), 0);
    const interval = window.setInterval(() => void loadMessages(selectedId, true), 15_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadMessages, newConversation, selectedId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function prepareFiles(event: ChangeEvent<HTMLInputElement>) {
    const remainingSlots = Math.max(
      0,
      5 - (newConversation ? draftImageUrls.length : 0)
    );
    const selected = Array.from(event.target.files || []).slice(0, remainingSlots);
    setNotice("");
    if (selected.some((file) => !/^image\/(png|jpe?g|webp)$/i.test(file.type))) {
      setNotice("รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP");
      return;
    }

    try {
      const compressed = await Promise.all(selected.map((file) => compressImage(file, 1600)));
      const totalBytes = compressed.reduce((sum, file) => sum + file.size, 0);
      if (totalBytes > 4 * 1024 * 1024) {
        setNotice("รูปทั้งหมดหลังย่อแล้วต้องมีขนาดไม่เกิน 4 MB");
        return;
      }
      setFiles(compressed);
    } catch (error) {
      console.error(error);
      setNotice("เตรียมรูปภาพไม่สำเร็จ");
    }
  }

  function resetComposer() {
    setMessage("");
    setFiles([]);
    setFileInputKey((key) => key + 1);
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const hasDraftImages = newConversation && draftImageUrls.length > 0;
    if (!message.trim() && files.length === 0 && !hasDraftImages) {
      setNotice("กรุณาพิมพ์ข้อความหรือแนบรูปอย่างน้อย 1 รูป");
      return;
    }

    setSending(true);
    try {
      const form = new FormData();
      form.set("message", message.trim());
      const draftFiles = hasDraftImages
        ? await Promise.all(
            draftImageUrls.slice(0, 5).map(async (imageUrl, index) => {
              const file = await dataUrlToFile(
                imageUrl,
                `generated-promo-${index + 1}.png`
              );
              return compressImage(file, 1600);
            })
          )
        : [];
      const outgoingFiles = [...draftFiles, ...files].slice(0, 5);
      const totalBytes = outgoingFiles.reduce((sum, file) => sum + file.size, 0);
      if (totalBytes > 4 * 1024 * 1024) {
        setNotice("รูปทั้งหมดต้องมีขนาดรวมไม่เกิน 4 MB กรุณาลดจำนวนรูปแล้วลองใหม่");
        return;
      }
      outgoingFiles.forEach((file) => form.append("images", file));

      let endpoint: string;
      if (newConversation) {
        form.set("subject", subject.trim());
        endpoint = "/api/support/conversations";
      } else if (selectedId) {
        endpoint = isAdmin
          ? `/api/admin/support/conversations/${selectedId}/messages`
          : `/api/support/conversations/${selectedId}/messages`;
      } else {
        setNotice("กรุณาเลือกบทสนทนา");
        return;
      }

      const response = await fetch(endpoint, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ส่งข้อความไม่สำเร็จ");

      resetComposer();
      if (newConversation) {
        setSubject("");
        setNewConversation(false);
        setSelectedId(data.conversationId);
      }
      await loadConversations(true);
      await loadMessages(data.conversationId || selectedId, true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  }

  async function updateStatus(status: SupportStatus) {
    if (!selectedId || !isAdmin) return;
    const response = await fetch(`/api/admin/support/conversations/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.error || "เปลี่ยนสถานะไม่สำเร็จ");
      return;
    }
    setConversations((items) =>
      items.map((item) => (item.id === selectedId ? { ...item, status } : item))
    );
  }

  if (accessDenied) {
    return (
      <div className="rounded-3xl border border-purple-300/20 bg-purple-300/[0.06] p-8 text-center">
        <div className="text-4xl">💬</div>
        <h2 className="mt-4 text-2xl font-black">Human VIP Support</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/55">
          ส่งข้อความและรูปงานที่เจนแล้วไม่ถูกใจให้ทีมงานมนุษย์ช่วยตรวจและแก้ไขได้
          ฟีเจอร์นี้เปิดให้สมาชิกแพ็ก Business 999 เท่านั้น
        </p>
        <a
          href="/pricing"
          className="mt-6 inline-flex rounded-xl bg-purple-300 px-5 py-3 font-black text-black transition hover:bg-purple-200"
        >
          ดูแพ็ก Business 999
        </a>
      </div>
    );
  }

  const selectedConversation = conversations.find((item) => item.id === selectedId) || null;

  return (
    <div
      className={
        compact
          ? "grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] lg:grid-cols-[300px_1fr] lg:grid-rows-1"
          : "grid min-h-[680px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] lg:grid-cols-[340px_1fr]"
      }
    >
      <aside
        className={`border-b border-white/10 bg-black/25 lg:border-b-0 lg:border-r ${
          compact ? "min-h-0 overflow-hidden" : ""
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div>
            <h2 className="font-black">{isAdmin ? "Support Inbox" : "กล่องข้อความ"}</h2>
            <p className="mt-1 text-xs text-white/40">อัปเดตอัตโนมัติทุก 15 วินาที</p>
          </div>
          {!isAdmin && (
            <button
              type="button"
              onClick={() => {
                setNewConversation(true);
                setSelectedId(null);
                resetComposer();
              }}
              className="rounded-xl bg-purple-300 px-3 py-2 text-xs font-black text-black hover:bg-purple-200"
            >
              + เปิดเคส
            </button>
          )}
        </div>

        <div
          className={
            compact
              ? "max-h-44 overflow-y-auto lg:h-[calc(100%-73px)] lg:max-h-none"
              : "max-h-72 overflow-y-auto lg:max-h-[620px]"
          }
        >
          {loading ? (
            <p className="p-5 text-sm text-white/40">กำลังโหลด...</p>
          ) : conversations.length === 0 ? (
            <p className="p-6 text-center text-sm leading-6 text-white/40">
              {isAdmin ? "ยังไม่มีเคสที่ส่งเข้ามา" : "ยังไม่มีบทสนทนา กด “เปิดเคส” เพื่อเริ่มต้น"}
            </p>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => {
                  setSelectedId(conversation.id);
                  setNewConversation(false);
                  resetComposer();
                }}
                className={`w-full border-b border-white/[0.06] p-4 text-left transition hover:bg-white/[0.04] ${
                  selectedId === conversation.id ? "bg-purple-300/[0.08]" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-1 text-sm font-bold">{conversation.subject}</p>
                  {conversation.unreadCount > 0 && (
                    <span className="min-w-5 rounded-full bg-fuchsia-400 px-1.5 py-0.5 text-center text-[10px] font-black text-black">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
                {conversation.user && (
                  <p className="mt-1 truncate text-xs text-purple-200/65">
                    {conversation.user.displayName || conversation.user.email}
                  </p>
                )}
                <p className="mt-2 line-clamp-1 text-xs text-white/35">
                  {conversation.lastMessagePreview}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusClass(conversation.status)}`}>
                    {STATUS_LABEL[conversation.status]}
                  </span>
                  <span className="text-[10px] text-white/25">
                    {new Date(conversation.lastMessageAt).toLocaleDateString("th-TH")}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section
        className={`flex flex-col ${
          compact ? "min-h-0 overflow-hidden" : "min-h-[600px]"
        }`}
      >
        {newConversation ? (
          <div className="flex flex-1 flex-col">
            <div className="border-b border-white/10 p-5">
              <h2 className="text-xl font-black">เปิดเคสใหม่กับทีมงาน</h2>
              <p className="mt-2 text-sm text-white/45">
                อธิบายจุดที่อยากแก้และแนบรูปที่เจนไม่ถูกใจได้สูงสุด 5 รูป
              </p>
            </div>
            <div className="flex-1 p-5">
              <label className="text-sm font-bold" htmlFor="support-subject">หัวข้อ</label>
              <input
                id="support-subject"
                value={subject}
                maxLength={160}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="เช่น ขอให้ช่วยแก้โปสเตอร์โปรโมชั่นเกม"
                className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 outline-none focus:border-purple-300/60"
              />

              {draftImageUrls.length > 0 ? (
                <div className="mt-4">
                  <p className="text-xs font-bold text-purple-200">
                    แนบภาพจากผลลัพธ์ล่าสุดแล้ว {Math.min(draftImageUrls.length, 5)} รูป
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {draftImageUrls.slice(0, 5).map((imageUrl, index) => (
                      <span
                        key={`${imageUrl.slice(0, 40)}-${index}`}
                        className="relative aspect-square overflow-hidden rounded-xl border border-purple-300/20 bg-black"
                      >
                        <Image
                          src={imageUrl}
                          alt={`ภาพผลลัพธ์ที่แนบ ${index + 1}`}
                          fill
                          unoptimized
                          sizes="120px"
                          className="object-cover"
                        />
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <Composer
              message={message}
              files={files}
              fileInputKey={fileInputKey}
              sending={sending}
              disabled={!subject.trim()}
              onMessageChange={setMessage}
              onFilesChange={prepareFiles}
              onSubmit={submitMessage}
            />
          </div>
        ) : !selectedConversation ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-white/40">
            เลือกบทสนทนาเพื่อดูข้อความ
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-black">{selectedConversation.subject}</h2>
                {selectedConversation.user && (
                  <p className="mt-1 text-xs text-white/40">{selectedConversation.user.email}</p>
                )}
              </div>
              {isAdmin ? (
                <select
                  value={selectedConversation.status}
                  onChange={(event) => void updateStatus(event.target.value as SupportStatus)}
                  className="rounded-xl border border-white/10 bg-[#15141b] px-3 py-2 text-xs font-bold outline-none"
                >
                  <option value="open">รอแอดมินตอบ</option>
                  <option value="in_progress">กำลังดูแล</option>
                  <option value="resolved">แก้ไขแล้ว</option>
                </select>
              ) : (
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${statusClass(selectedConversation.status)}`}>
                  {STATUS_LABEL[selectedConversation.status]}
                </span>
              )}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              {threadLoading ? (
                <p className="text-sm text-white/40">กำลังโหลดข้อความ...</p>
              ) : (
                messages.map((item) => {
                  const mine = isAdmin ? item.senderRole === "admin" : item.senderRole === "user";
                  return (
                    <article key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[72%] ${
                        mine ? "bg-purple-300 text-black" : "border border-white/10 bg-white/[0.06] text-white"
                      }`}>
                        <p className={`text-[11px] font-bold ${mine ? "text-black/55" : "text-purple-200/65"}`}>
                          {item.senderRole === "admin" ? "ทีมงาน LAZY-AI.GAME" : item.senderName || "ลูกค้า"}
                        </p>
                        {item.body && <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.body}</p>}
                        {item.attachments.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {item.attachments.map((attachment) => (
                              <a
                                key={attachment.id}
                                href={`/api/support/attachments/${attachment.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="relative aspect-square overflow-hidden rounded-xl bg-black/40"
                              >
                                <Image
                                  src={`/api/support/attachments/${attachment.id}`}
                                  alt={attachment.originalFilename || "รูปแนบในแชต"}
                                  fill
                                  unoptimized
                                  sizes="240px"
                                  className="object-cover transition hover:scale-105"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                        <p className={`mt-2 text-[10px] ${mine ? "text-black/45" : "text-white/30"}`}>
                          {new Date(item.createdAt).toLocaleString("th-TH")}
                        </p>
                      </div>
                    </article>
                  );
                })
              )}
              <div ref={threadEndRef} />
            </div>

            <Composer
              message={message}
              files={files}
              fileInputKey={fileInputKey}
              sending={sending}
              onMessageChange={setMessage}
              onFilesChange={prepareFiles}
              onSubmit={submitMessage}
            />
          </>
        )}

        {notice && (
          <div className="border-t border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">
            {notice}
          </div>
        )}
      </section>
    </div>
  );
}

function Composer({
  message,
  files,
  fileInputKey,
  sending,
  disabled = false,
  onMessageChange,
  onFilesChange,
  onSubmit,
}: {
  message: string;
  files: File[];
  fileInputKey: number;
  sending: boolean;
  disabled?: boolean;
  onMessageChange: (value: string) => void;
  onFilesChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="border-t border-white/10 bg-black/20 p-4">
      {files.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <span
              key={`${file.name}-${index}`}
              className="max-w-48 truncate rounded-lg border border-purple-300/20 bg-purple-300/10 px-2 py-1 text-xs text-purple-100"
            >
              {file.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <textarea
          value={message}
          maxLength={4000}
          onChange={(event) => onMessageChange(event.target.value)}
          placeholder="พิมพ์รายละเอียดที่ต้องการให้ช่วยแก้..."
          rows={3}
          className="min-h-24 flex-1 resize-none rounded-xl border border-white/10 bg-black/45 px-4 py-3 text-sm leading-6 outline-none placeholder:text-white/30 focus:border-purple-300/60"
        />
        <div className="flex gap-2 sm:flex-col">
          <label className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-bold text-white/65 transition hover:border-purple-300/40 hover:text-white">
            📎 แนบรูป
            <input
              key={fileInputKey}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="sr-only"
              onChange={onFilesChange}
            />
          </label>
          <button
            type="submit"
            disabled={sending || disabled}
            className="min-h-11 flex-1 rounded-xl bg-purple-300 px-5 text-sm font-black text-black transition hover:bg-purple-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? "กำลังส่ง..." : "ส่งข้อความ"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-white/30">แนบได้สูงสุด 5 รูป · JPG, PNG, WebP · รวมไม่เกิน 4 MB</p>
    </form>
  );
}
