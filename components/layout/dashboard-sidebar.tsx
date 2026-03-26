"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavItem, SidebarNavItem } from "@/types";
import { Menu, PanelLeftClose, PanelRightClose } from "lucide-react";
import Image from "next/image";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Icons } from "@/components/shared/icons";

interface DashboardSidebarProps {
  links: SidebarNavItem[];
}

export function DashboardSidebar({ links }: DashboardSidebarProps) {
  const path = usePathname();
  const { isTablet } = useMediaQuery();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(!isTablet);

  const toggleSidebar = () => {
    setIsSidebarExpanded(!isSidebarExpanded);
  };

  useEffect(() => {
    setIsSidebarExpanded(!isTablet);
  }, [isTablet]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="sticky top-0 h-full max-w-full overflow-x-hidden">
        <ScrollArea className="h-full w-full max-w-full overflow-x-hidden overflow-y-auto border-r">
          <aside
            className={cn(
              isSidebarExpanded ? "w-[220px] xl:w-[260px]" : "w-[68px]",
              "hidden h-screen md:block max-w-full overflow-x-hidden"
            )}
          >
            <div className="flex h-full max-h-screen flex-1 flex-col gap-2 min-w-0">
              {/* HEADER */}
              <div className="flex h-14 items-center p-4 lg:h-[60px] min-w-0">
                {isSidebarExpanded && (
                  <Link href="/" className="flex items-center min-w-0">
                    <img
                      src="/lunchlog.png"
                      alt="LunchLog"
                      width={240}
                      height={60}
                      className="w-[180px] max-w-[240px] h-auto pt-5 pb-3 object-contain"
                    />
                  </Link>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-9 lg:size-8 shrink-0"
                  onClick={toggleSidebar}
                >
                  {isSidebarExpanded ? (
                    <PanelLeftClose size={18} />
                  ) : (
                    <PanelRightClose size={18} />
                  )}
                </Button>
              </div>

              {/* NAV */}
              <nav className="flex flex-1 flex-col gap-8 px-4 pt-4 min-w-0">
                {links.map((section) => (
                  <section key={section.title} className="flex flex-col gap-0.5 min-w-0">
                    {isSidebarExpanded ? (
                      <p className="text-xs text-muted-foreground truncate">
                        {section.title}
                      </p>
                    ) : (
                      <div className="h-4" />
                    )}

                    {section.items.map((item) => {
                      const Icon = Icons[item.icon || "arrowRight"];

                      return (
                        item.href && (
                          <Fragment key={item.title}>
                            {isSidebarExpanded ? (
                              <Link
                                href={item.disabled ? "#" : item.href}
                                className={cn(
                                  "flex items-center gap-3 rounded-md p-2 text-sm font-medium min-w-0",
                                  path === item.href
                                    ? "bg-muted"
                                    : "text-muted-foreground hover:text-accent-foreground"
                                )}
                              >
                                <Icon className="size-5 shrink-0" />
                                <span className="truncate">{item.title}</span>

                                {item.badge && (
                                  <Badge className="ml-auto shrink-0">
                                    {item.badge}
                                  </Badge>
                                )}
                              </Link>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Link
                                    href={item.disabled ? "#" : item.href}
                                    className="flex items-center justify-center py-2"
                                  >
                                    <Icon className="size-5" />
                                  </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                  {item.title}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </Fragment>
                        )
                      );
                    })}
                  </section>
                ))}
              </nav>
            </div>
          </aside>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}

export function MobileSheetSidebar({ links }: DashboardSidebarProps) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { isSm, isMobile } = useMediaQuery();

  if (isSm || isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        {/* TRIGGER */}
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0 md:hidden"
          >
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>

        {/* CENTER LOGO */}
        <Link
          href="/"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center md:hidden"
        >
          <Image
            src="/lunchlog.png"
            alt="LunchLog"
            width={140}
            height={40}
            className="object-contain"
            priority
          />
        </Link>

        {/* SHEET */}
        <SheetContent
          side="left"
          className="flex flex-col p-0 w-[85vw] max-w-[320px] overflow-x-hidden"
        >
          <ScrollArea className="h-full w-full max-w-full overflow-x-hidden overflow-y-auto">
            <div className="flex h-screen max-w-full flex-col overflow-x-hidden">
              <nav className="flex flex-1 flex-col gap-y-8 p-6 text-lg font-medium bg-white min-w-0">
                {/* LOGO */}
                <Link href="/" className="flex items-center min-w-0">
                  <img
                    src="/lunchlog.png"
                    alt="LunchLog"
                    width={240}
                    height={60}
                    className="w-[180px] max-w-[240px] h-auto object-contain"
                  />
                </Link>

                {links.map((section) => (
                  <section key={section.title} className="flex flex-col gap-0.5 min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {section.title}
                    </p>

                    {section.items.map((item) => {
                      const Icon = Icons[item.icon || "arrowRight"];

                      return (
                        item.href && (
                          <Link
                            key={item.title}
                            onClick={() => {
                              if (!item.disabled) setOpen(false);
                            }}
                            href={item.disabled ? "#" : item.href}
                            className={cn(
                              "flex items-center gap-3 rounded-md p-2 text-sm font-medium min-w-0",
                              path === item.href
                                ? "bg-muted"
                                : "text-muted-foreground hover:text-accent-foreground"
                            )}
                          >
                            <Icon className="size-5 shrink-0" />
                            <span className="truncate">{item.title}</span>

                            {item.badge && (
                              <Badge className="ml-auto shrink-0">
                                {item.badge}
                              </Badge>
                            )}
                          </Link>
                        )
                      );
                    })}
                  </section>
                ))}
              </nav>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="flex size-9 animate-pulse rounded-lg bg-muted md:hidden" />
  );
}