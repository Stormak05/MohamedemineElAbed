import type { ButtonHTMLAttributes, ReactNode } from "react";

import { sfx } from "@/lib/game";

/**
 * A screen of the site over the game: the game's veil, small logo and painted panel (packages/game/ui-kit.js).
 * The room keeps rendering behind it, as under the game's own menus.
 */
export function Screen({
  title,
  wide,
  children,
}: {
  title?: string;
  /** A wider panel, for text rather than forms (the welcome screen). */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="cl-menus">
      <div className="veil heavy" />
      <div className="cl-col">
        <div className="logo small">
          <img src="/game/ui/title.png" alt="Clausus" width={912} height={178} />
        </div>
        {title !== undefined && (
          <section className={wide ? "panel cl-sheet wide" : "panel cl-sheet"} aria-label={title}>
            <h2>{title}</h2>
            <div className="rule" />
            {children}
          </section>
        )}
        {title === undefined && children}
      </div>
    </div>
  );
}

type Variant = "primary" | "small" | "danger";

/** A menu button of the game, with its sounds. */
export function MenuButton({
  variant,
  className,
  onClick,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      type={type}
      className={["mb", variant, className].filter(Boolean).join(" ")}
      onMouseEnter={() => sfx("hover")}
      onClick={(event) => {
        sfx("click");
        onClick?.(event);
      }}
    />
  );
}
