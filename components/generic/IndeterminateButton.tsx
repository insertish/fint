"use client";

import { ReactNode, useState } from "react";

type Props = {
  onClick: () => Promise<any>;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
};

export function IndeterminateButton({
  onClick,
  children,
  disabled,
  className,
}: Props) {
  const [working, setWorking] = useState(false);

  if (working) {
    return <progress className="progress w-28 my-3 inline-block" />;
  } else {
    return (
      <button
        className={
          className ??
          `btn w-28 ${disabled ? "btn-disabled" : "btn-neutral"} btn-sm`
        }
        onClick={async () => {
          setWorking(true);
          await onClick();
          setWorking(false);
        }}
      >
        {children}
      </button>
    );
  }
}
