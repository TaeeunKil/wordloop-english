"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingLabel = "연결 중…", className = "" }: {
  children: React.ReactNode; pendingLabel?: string; className?: string;
}) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending} aria-busy={pending}>
    {pending ? pendingLabel : children}
  </button>;
}
