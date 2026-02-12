import { UserRole } from "@prisma/client";
import { SidebarNavItem } from "types";

export const sidebarLinks: SidebarNavItem[] = [
  {
    title: "MENU",
    items: [
      {
        href: "/admin/kitchen-prep",
        icon: "ReceiptText",
        title: "Lunch Orders",
        authorizeOnly: UserRole.ADMIN,
      },
      {
        href: "/admin",
        icon: "UtensilsCrossed",
        title: "Manage Meals",
        authorizeOnly: UserRole.ADMIN,
      },
      {
        href: "/admin/schools",
        icon: "School",
        title: "View Schools",
        authorizeOnly: UserRole.ADMIN,
      },
      {
        href: "/admin/schedule",
        icon: "CalendarDays",
        title: "Schedule",
        authorizeOnly: UserRole.ADMIN,
      },
      {
        href: "/school-admin/orders",
        icon: "ReceiptText",
        title: "Lunch Orders",
        authorizeOnly: UserRole.SCHOOLADMIN,
      },
      {
        href: "/school-admin/schedule",
        icon: "CalendarDays",
        title: "Schedule",
        authorizeOnly: UserRole.SCHOOLADMIN,
      },
      {
        href: "/school-admin/classrooms",
        icon: "PersonStanding",
        title: "Pupil Registry",
        authorizeOnly: UserRole.SCHOOLADMIN,
      },
      {
        href: "/school-admin/meals",
        icon: "UtensilsCrossed",
        title: "View Meals",
        authorizeOnly: UserRole.SCHOOLADMIN,
      },
      {
        href: "/parent/orders",
        icon: "post",
        title: "Order Lunch",
        authorizeOnly: UserRole.USER,
      },
      {
        href: "/parent/pupils",
        icon: "PersonStanding",
        title: "Edit Pupils",
        authorizeOnly: UserRole.USER,
      },
            {
        href: "/parent/schedule",
        icon: "CalendarDays",
        title: "School Schedule",
        authorizeOnly: UserRole.USER,
      },

    ],
  },
  {
    title: "OPTIONS",
    items: [
      {
        href: "/settings",
        icon: "settings",
        title: "Settings",
      },
      {
        href: "https://lunchlog.ie",
        icon: "home",
        title: "Homepage",
      },
      {
        href: "/faq",
        icon: "bookOpen",
        title: "FAQ",
      },
      {
        href: "#",
        icon: "messages",
        title: "Support",
      },
    ],
  },
];
