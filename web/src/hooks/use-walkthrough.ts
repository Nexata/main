import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import {
  "walkthrough.welcome_title" as wt_welcome_title,
  "walkthrough.welcome_description" as wt_welcome_description,
  "walkthrough.chat_input_title" as wt_chat_input_title,
  "walkthrough.chat_input_description" as wt_chat_input_description,
  "walkthrough.brain_title" as wt_brain_title,
  "walkthrough.brain_description" as wt_brain_description,
  "walkthrough.sidebar_title" as wt_sidebar_title,
  "walkthrough.sidebar_description" as wt_sidebar_description,
  "walkthrough.sidebar_multiselect_title" as wt_sidebar_multiselect_title,
  "walkthrough.sidebar_multiselect_description" as wt_sidebar_multiselect_description,
  "walkthrough.sidebar_buttons_title" as wt_sidebar_buttons_title,
  "walkthrough.sidebar_buttons_description" as wt_sidebar_buttons_description,
  "walkthrough.user_title" as wt_user_title,
  "walkthrough.user_description" as wt_user_description,
  "walkthrough.settings_title" as wt_settings_title,
  "walkthrough.settings_description" as wt_settings_description,
  "walkthrough.admin_title" as wt_admin_title,
  "walkthrough.admin_description" as wt_admin_description,
  "walkthrough.done_title" as wt_done_title,
  "walkthrough.done_description" as wt_done_description,
  "walkthrough.btn_next" as wt_btn_next,
  "walkthrough.btn_prev" as wt_btn_prev,
  "walkthrough.btn_done" as wt_btn_done,
  "walkthrough.user_profile_card_title" as wt_user_profile_card_title,
  "walkthrough.user_profile_card_description" as wt_user_profile_card_description,
  "walkthrough.user_devices_title" as wt_user_devices_title,
  "walkthrough.user_devices_description" as wt_user_devices_description,
  "walkthrough.user_api_keys_title" as wt_user_api_keys_title,
  "walkthrough.user_api_keys_description" as wt_user_api_keys_description,
  "walkthrough.settings_sources_title" as wt_settings_sources_title,
  "walkthrough.settings_sources_description" as wt_settings_sources_description,
  "walkthrough.settings_storage_title" as wt_settings_storage_title,
  "walkthrough.settings_storage_description" as wt_settings_storage_description,
  "walkthrough.settings_files_title" as wt_settings_files_title,
  "walkthrough.settings_files_description" as wt_settings_files_description,
  "walkthrough.settings_external_dirs_title" as wt_settings_external_dirs_title,
  "walkthrough.settings_external_dirs_description" as wt_settings_external_dirs_description,
  "walkthrough.admin_overview_title" as wt_admin_overview_title,
  "walkthrough.admin_overview_description" as wt_admin_overview_description,
  "walkthrough.admin_billing_title" as wt_admin_billing_title,
  "walkthrough.admin_billing_description" as wt_admin_billing_description,
  "walkthrough.admin_traces_title" as wt_admin_traces_title,
  "walkthrough.admin_traces_description" as wt_admin_traces_description,
  "walkthrough.admin_users_title" as wt_admin_users_title,
  "walkthrough.admin_users_description" as wt_admin_users_description,
} from "@/paraglide/messages.js";

const STORAGE_KEY = "nexata-walkthrough-completed";

type TourPage = "chat" | "user" | "settings" | "adminsettings" | null;

interface TaggedStep extends DriveStep {
  page?: TourPage;
}

const PAGE_ROUTES: Record<NonNullable<TourPage>, string> = {
  chat: "/chat",
  user: "/user",
  settings: "/settings",
  adminsettings: "/adminsettings",
};

function isWalkthroughCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function markWalkthroughCompleted(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // localStorage unavailable
  }
}

function buildSteps(isAdmin: boolean): TaggedStep[] {
  const steps: TaggedStep[] = [
    // 1. Welcome
    {
      page: null,
      popover: {
        title: wt_welcome_title(),
        description: wt_welcome_description(),
      },
    },
    // 2. Chat input
    {
      page: "chat",
      element: '[data-tour="chat-input"]',
      popover: {
        title: wt_chat_input_title(),
        description: wt_chat_input_description(),
        side: "top",
        align: "center",
      },
    },
    // 3. Brain button
    {
      page: "chat",
      element: '[data-tour="brain-button"]',
      popover: {
        title: wt_brain_title(),
        description: wt_brain_description(),
        side: "top",
        align: "center",
      },
    },
    // 4. Sidebar (combined with toggle — mentions Ctrl+B)
    {
      page: null,
      element: '[data-tour="sidebar"]',
      popover: {
        title: wt_sidebar_title(),
        description: wt_sidebar_description(),
        side: "right",
        align: "center",
      },
    },
    // 5. Multi-select threads (hover for individual actions)
    {
      page: null,
      element: '[data-tour="sidebar-threads"]',
      popover: {
        title: wt_sidebar_multiselect_title(),
        description: wt_sidebar_multiselect_description(),
        side: "right",
        align: "center",
      },
    },
    // 6. Sidebar buttons (quick actions)
    {
      page: null,
      element: '[data-tour="sidebar-buttons"]',
      popover: {
        title: wt_sidebar_buttons_title(),
        description: wt_sidebar_buttons_description(),
        side: "right",
        align: "start",
      },
    },
    // 7. User section in sidebar (language + logout)
    {
      page: null,
      element: '[data-tour="user-section"]',
      popover: {
        title: wt_user_title(),
        description: wt_user_description(),
        side: "right",
        align: "end",
      },
    },
    // --- User page steps ---
    // 8. User profile card
    {
      page: "user",
      element: '[data-tour="user-profile-card"]',
      popover: {
        title: wt_user_profile_card_title(),
        description: wt_user_profile_card_description(),
        side: "bottom",
        align: "center",
      },
    },
    // 9. User devices
    {
      page: "user",
      element: '[data-tour="user-devices"]',
      popover: {
        title: wt_user_devices_title(),
        description: wt_user_devices_description(),
        side: "top",
        align: "center",
      },
    },
    // 10. User API keys + danger zone
    {
      page: "user",
      element: '[data-tour="user-api-keys"]',
      popover: {
        title: wt_user_api_keys_title(),
        description: wt_user_api_keys_description(),
        side: "top",
        align: "center",
      },
    },
    // --- Settings page steps ---
    // 11. Settings button in sidebar
    {
      page: null,
      element: '[data-tour="settings-button"]',
      popover: {
        title: wt_settings_title(),
        description: wt_settings_description(),
        side: "right",
        align: "center",
      },
    },
    // 12. Settings sources (dynamic, real-time, 1-click)
    {
      page: "settings",
      element: '[data-tour="settings-sources"]',
      popover: {
        title: wt_settings_sources_title(),
        description: wt_settings_sources_description(),
        side: "bottom",
        align: "center",
      },
    },
    // 13. Settings storage (file-based external sources)
    {
      page: "settings",
      element: '[data-tour="settings-storage"]',
      popover: {
        title: wt_settings_storage_title(),
        description: wt_settings_storage_description(),
        side: "top",
        align: "center",
      },
    },
    // 14. Settings files
    {
      page: "settings",
      element: '[data-tour="settings-files"]',
      popover: {
        title: wt_settings_files_title(),
        description: wt_settings_files_description(),
        side: "top",
        align: "center",
      },
    },
    // 15. External folders
    {
      page: "settings",
      element: '[data-tour="settings-external-dirs"]',
      popover: {
        title: wt_settings_external_dirs_title(),
        description: wt_settings_external_dirs_description(),
        side: "bottom",
        align: "center",
      },
      onHighlightStarted: (element) => {
        element?.scrollIntoView({ block: "start", behavior: "instant" });
      },
    },
  ];

  if (isAdmin) {
    // 15. Admin panel intro (sidebar)
    steps.push({
      page: null,
      element: '[data-tour="settings-button"]',
      popover: {
        title: wt_admin_title(),
        description: wt_admin_description(),
        side: "right",
        align: "center",
      },
    });
    // --- Admin settings page steps ---
    // 16. Company overview
    steps.push({
      page: "adminsettings",
      element: '[data-tour="admin-overview"]',
      popover: {
        title: wt_admin_overview_title(),
        description: wt_admin_overview_description(),
        side: "bottom",
        align: "center",
      },
    });
    // 17. Billing
    steps.push({
      page: "adminsettings",
      element: '[data-tour="admin-billing"]',
      popover: {
        title: wt_admin_billing_title(),
        description: wt_admin_billing_description(),
        side: "top",
        align: "center",
      },
    });
    // 18. Traces
    steps.push({
      page: "adminsettings",
      element: '[data-tour="admin-traces"]',
      popover: {
        title: wt_admin_traces_title(),
        description: wt_admin_traces_description(),
        side: "top",
        align: "center",
      },
    });
    // 19. Users management
    steps.push({
      page: "adminsettings",
      element: '[data-tour="admin-users"]',
      popover: {
        title: wt_admin_users_title(),
        description: wt_admin_users_description(),
        side: "top",
        align: "center",
      },
    });
  }

  // Done
  steps.push({
    page: null,
    popover: {
      title: wt_done_title(),
      description: wt_done_description(),
    },
  });

  return steps;
}

function getPageForStep(steps: TaggedStep[], index: number): TourPage {
  return steps[index]?.page ?? null;
}

export function useWalkthrough(isAdmin: boolean) {
  const driverRef = useRef<Driver | null>(null);
  const stepsRef = useRef<TaggedStep[]>([]);
  const navigate = useNavigate();

  const navigateAndMove = useCallback(
    (targetPage: TourPage, moveToIndex: number) => {
      const d = driverRef.current;
      if (!d) return;

      if (targetPage) {
        navigate({ to: PAGE_ROUTES[targetPage] });
        // Wait for React to render the new page before moving
        setTimeout(() => d.moveTo(moveToIndex), 400);
      } else {
        d.moveTo(moveToIndex);
      }
    },
    [navigate],
  );

  const start = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
    }

    const steps = buildSteps(isAdmin);
    stepsRef.current = steps;

    const driverInstance = driver({
      showProgress: true,
      animate: true,
      smoothScroll: true,
      allowClose: true,
      overlayColor: "black",
      overlayOpacity: 0.6,
      stagePadding: 8,
      stageRadius: 12,
      popoverClass: "nexata-tour-popover",
      nextBtnText: wt_btn_next(),
      prevBtnText: wt_btn_prev(),
      doneBtnText: wt_btn_done(),
      progressText: "{{current}} / {{total}}",
      steps: steps as DriveStep[],
      onNextClick: () => {
        const current = driverInstance.getActiveIndex();
        if (current === undefined || current === null) return;
        const nextIndex = current + 1;
        if (nextIndex >= steps.length) {
          driverInstance.destroy();
          return;
        }
        const currentPage = getPageForStep(steps, current);
        const nextPage = getPageForStep(steps, nextIndex);
        if (nextPage && nextPage !== currentPage) {
          navigateAndMove(nextPage, nextIndex);
        } else if (!nextPage && currentPage) {
          // Going back to a sidebar/global step from a page
          navigate({ to: PAGE_ROUTES.chat });
          setTimeout(() => driverInstance.moveTo(nextIndex), 400);
        } else {
          driverInstance.moveNext();
        }
      },
      onPrevClick: () => {
        const current = driverInstance.getActiveIndex();
        if (current === undefined || current === null || current === 0) return;
        const prevIndex = current - 1;
        const currentPage = getPageForStep(steps, current);
        const prevPage = getPageForStep(steps, prevIndex);
        if (prevPage && prevPage !== currentPage) {
          navigateAndMove(prevPage, prevIndex);
        } else if (!prevPage && currentPage) {
          navigate({ to: PAGE_ROUTES.chat });
          setTimeout(() => driverInstance.moveTo(prevIndex), 400);
        } else {
          driverInstance.movePrevious();
        }
      },
      onDestroyed: () => {
        markWalkthroughCompleted();
        // Navigate back to chat when tour ends
        navigate({ to: PAGE_ROUTES.chat });
      },
    });

    driverRef.current = driverInstance;
    driverInstance.drive();
  }, [isAdmin, navigateAndMove, navigate]);

  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
    };
  }, []);

  return {
    start,
    isCompleted: isWalkthroughCompleted(),
    markCompleted: markWalkthroughCompleted,
  };
}
