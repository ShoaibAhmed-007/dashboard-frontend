"use client";

/**
 * The three setup prompts shown at the top of a newly created channel.
 *
 * Each card carries its own pastel tint from the design rather than a shared
 * token — they read as a set of illustrations, not as themed surfaces, so the
 * colours are intentionally literal here.
 */
const CARDS = [
  {
    id: "people",
    label: "Add people to channel",
    src: "/images/chat/Add-People.svg",
    // Pink
    className: "bg-[#FBEEF3] dark:bg-[#3A2933]",
    labelClass: "text-[#B4356F] dark:text-[#F0A8C8]",
  },
  {
    id: "description",
    label: "Add channel description",
    src: "/images/chat/Add-Description.svg",
    // Blue
    className: "bg-[#EAF4F7] dark:bg-[#22333A]",
    labelClass: "text-[#1B6E8C] dark:text-[#8FCFE4]",
  },
  {
    id: "template",
    label: "Pick a template",
    src: "/images/chat/Pick-Template.svg",
    // Green
    className: "bg-[#EDF5EC] dark:bg-[#26332A]",
    labelClass: "text-[#2F7A3E] dark:text-[#9CD6A8]",
  },
] as const;

export default function ChannelOnboardingCards({
  isPrivate = false,
  onAddPeople,
}: {
  /** Private channels are invite-only, so only they get the "Add people"
   *  card. A public channel already holds the whole workspace — the server
   *  enrols everyone on creation — so there is nobody to add. */
  isPrivate?: boolean;
  /** Opens the details panel, where members are managed. */
  onAddPeople?: () => void;
}) {
  const cards = isPrivate ? CARDS : CARDS.filter((card) => card.id !== "people");

  return (
    /* Column count follows the card count, so two cards fill the row rather
       than leaving a third empty slot. */
    <div
      className={`grid gap-4 sm:grid-cols-2 ${
        cards.length > 2 ? "lg:grid-cols-3" : ""
      }`}
    >
      {cards.map((card) => (
        <button
          key={card.label}
          type="button"
          onClick={card.id === "people" ? onAddPeople : undefined}
          className={`flex flex-col gap-4 rounded-xl p-4 text-left transition-opacity hover:opacity-90 ${card.className}`}
        >
          <span className={`text-sm font-semibold ${card.labelClass}`}>
            {card.label}
          </span>
          {/* Fixed-height box so the three cards stay level whatever each
              illustration's intrinsic ratio is.

              A plain <img>, not next/image: optimising SVG needs
              `dangerouslyAllowSVG`, which this project deliberately doesn't
              set. These are static local decorations, so there is nothing for
              the optimiser to do anyway. */}
          <span className="block h-[150px] w-full overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.src}
              alt=""
              className="h-full w-full object-contain"
            />
          </span>
        </button>
      ))}
    </div>
  );
}
