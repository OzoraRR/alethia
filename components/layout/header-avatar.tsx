"use client";

/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import { useProfileAvatar } from "@/features/profile/avatar-persistence";

export function HeaderAvatar() {
  const { avatarUrl } = useProfileAvatar();
  if (avatarUrl) {
    return (
      <span className="header-avatar" aria-hidden="true">
        <img alt="" src={avatarUrl} />
      </span>
    );
  }
  return (
    <span className="header-avatar" aria-hidden="true">
      <Image alt="" height={28} src="/media/operator-pixel.svg" width={28} />
    </span>
  );
}
