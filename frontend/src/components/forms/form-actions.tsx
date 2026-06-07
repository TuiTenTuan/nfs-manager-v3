import { cn } from "@/lib/utils";

type FormActionsProps = {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end";
};

export function FormActions({ children, className, align = "end" }: FormActionsProps) {
  return (
    <div
      className={cn(
        "form-actions",
        align === "start" ? "justify-start" : "justify-end",
        className
      )}
    >
      {children}
    </div>
  );
}
