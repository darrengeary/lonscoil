"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/components/shared/icons";
import { cn } from "@/lib/utils";

export function BottomNav({ links }) {
  const path = usePathname();

  // Flatten all nav sections to a single array of items
  const navItems = links.flatMap(section => section.items).filter(i => !!i.href);

  return (
<nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t shadow-md flex justify-between items-center h-16 md:hidden">
  {navItems.slice(0, 4).map((item) => {
    const Icon = Icons[item.icon || "arrowRight"];
    const isActive = path === item.href;
    return (
      <Link
        key={item.title}
        href={item.href}
        className={cn(
          "flex flex-col items-center justify-center flex-1 py-1 px-2 text-xs font-medium transition",
          isActive
            ? "text-primary"
            : "text-muted-foreground hover:text-accent-foreground"
        )}
      >
        <Icon className={cn("mb-0.5", isActive ? "stroke-[2]" : "stroke-[1.5]", "w-6 h-6")} />
        <span className="truncate">{item.title}</span>
      </Link>
    );
  })}
</nav>

  );
}
