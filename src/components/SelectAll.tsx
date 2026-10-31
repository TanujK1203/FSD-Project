"use client";

export function SelectAll({ formId }: { formId: string }) {
  return (
    <label className="check">
      <input
        type="checkbox"
        defaultChecked={false}
        onChange={(e) => {
          document
            .querySelectorAll<HTMLInputElement>(`input[type="checkbox"][form="${formId}"]`)
            .forEach((c) => (c.checked = e.currentTarget.checked));
        }}
      />
      Select all
    </label>
  );
}
