"use client";

import { useEffect, useState } from "react";

type AdminPayment = {
  id: string;
  userEmail: string;
  planName: string;
  amountThb: number;
  method: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  hasProof: boolean;
  proofNote: string | null;
  proofStatus: string | null;
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [actingPaymentId, setActingPaymentId] = useState<string | null>(null);

  async function loadPayments() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/payments?status=pending");
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "โหลดรายการไม่สำเร็จ");
        setPayments([]);
        return;
      }

      setPayments(data.payments || []);
    } catch (error) {
      console.error(error);
      setMessage("โหลดรายการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadInitialPayments() {
      try {
        const res = await fetch("/api/admin/payments?status=pending");
        const data = await res.json();

        if (!active) return;

        if (!res.ok) {
          setMessage(data.error || "โหลดรายการไม่สำเร็จ");
          setPayments([]);
          return;
        }

        setPayments(data.payments || []);
      } catch (error) {
        console.error(error);
        if (active) setMessage("โหลดรายการไม่สำเร็จ");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInitialPayments();

    return () => {
      active = false;
    };
  }, []);

  async function actOnPayment(paymentId: string, action: "approve" | "reject") {
    if (actingPaymentId) return;
    if (!window.confirm(action === "approve" ? "ยืนยันอนุมัติการชำระเงินและเปิดแพ็กเกจให้สมาชิก?" : "ยืนยันปฏิเสธหลักฐานการชำระเงินนี้?")) return;
    setActingPaymentId(paymentId);
    setMessage("");

    try {
      const res = await fetch(`/api/admin/payments/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          paymentId,
          reason: action === "reject" ? "Payment proof rejected by admin" : "",
        }),
      });
      const data = await res.json();

      const responseMessage = data.message || data.error || "ดำเนินการแล้ว";
      setMessage(
        data.requestId
          ? `${responseMessage} (Request ID: ${data.requestId})`
          : responseMessage
      );
      if (res.ok) {
        await loadPayments();
      }
    } catch (error) {
      console.error(error);
      setMessage("ดำเนินการไม่สำเร็จ");
    } finally {
      setActingPaymentId(null);
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-sm font-medium text-purple-300">
              LAZY-AI.GAME Admin
            </p>
            <h1 className="text-4xl font-semibold tracking-tight">
              ตรวจการชำระเงิน
            </h1>
          </div>
          <button
            type="button"
            onClick={loadPayments}
            className="rounded-2xl border border-white/10 px-5 py-3 font-bold text-white/70 transition hover:border-white/30 hover:text-white"
          >
            โหลดรายการใหม่
          </button>
        </div>

        {message && (
          <div className="mb-5 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 text-sm text-yellow-100">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-muted">
            กำลังโหลดรายการ...
          </div>
        ) : payments.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center text-muted">
            ตรวจครบแล้ว ไม่มีรายการรอตรวจ
          </div>
        ) : (
          <div className="grid gap-4">
            {payments.map((payment) => (
              <article
                key={payment.id}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold">{payment.planName}</h2>
                      <span className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-black">
                        {payment.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      {payment.userEmail}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {payment.method} ·{" "}
                      {new Date(payment.createdAt).toLocaleString("th-TH")}
                    </p>
                    <p className="mt-1 text-xs text-amber-200">
                      หมดอายุ {new Date(payment.expiresAt).toLocaleString("th-TH")}
                    </p>
                    <p className="mt-4 text-3xl font-semibold text-purple-300">
                      ฿{payment.amountThb}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={Boolean(actingPaymentId) || !payment.hasProof}
                      onClick={() => actOnPayment(payment.id, "approve")}
                      className="rounded-2xl bg-emerald-400 px-5 py-3 font-bold text-black transition hover:bg-emerald-300 disabled:opacity-60"
                    >
                      {actingPaymentId === payment.id ? "กำลังดำเนินการ…" : "อนุมัติการชำระเงิน"}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(actingPaymentId)}
                      onClick={() => actOnPayment(payment.id, "reject")}
                      className="rounded-2xl border border-red-300/30 px-5 py-3 font-bold text-red-200 transition hover:bg-red-400/10 disabled:opacity-60"
                    >
                      ปฏิเสธหลักฐาน
                    </button>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
                  <p className="font-bold">หลักฐาน</p>
                  {payment.hasProof ? (
                    <a
                      href={`/api/payments/proof/${payment.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block rounded-xl border border-emerald-300/30 px-4 py-2 font-bold text-emerald-300 transition hover:text-emerald-200"
                    >
                      เปิดดูสลิปแบบ private
                    </a>
                  ) : (
                    <p className="mt-2 text-muted">ยังไม่มีหลักฐาน</p>
                  )}
                  {payment.proofNote && (
                    <p className="mt-3 text-muted">{payment.proofNote}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
