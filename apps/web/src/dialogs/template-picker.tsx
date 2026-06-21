/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import { useState } from "react";
import { Button, Flex, Text } from "@theme-ui/components";
import {
  Note as NoteType,
  VirtualizedGrouping,
  isDecryptedContent
} from "@notesnook/core";
import { ResolvedItem } from "@notesnook/common";
import { strings } from "@notesnook/intl";
import { Virtuoso } from "react-virtuoso";
import Dialog from "../components/dialog";
import { db } from "../common/db";
import { checkFeature } from "../common";
import { BaseDialogProps, DialogManager } from "../common/dialog-manager";
import { CustomScrollbarsVirtualList } from "../components/list-container";
import { useEditorStore } from "../stores/editor-store";
import { useEditorManager } from "../components/editor/manager";
import { showToast } from "../utils/toast";

export type TemplatePickerProps = BaseDialogProps<boolean> & {
  mode: "new" | "insert";
};

export const TemplatePicker = DialogManager.register(
  function TemplatePicker(props: TemplatePickerProps) {
    const { mode } = props;
    const [notes, setNotes] = useState<VirtualizedGrouping<NoteType>>();
    const [hasSource, setHasSource] = useState(true);
    const [loading, setLoading] = useState(true);

    const applyTemplate = async (note: NoteType) => {
      const content = note.contentId
        ? await db.content.get(note.contentId)
        : undefined;
      if (content && !isDecryptedContent(content)) {
        showToast("error", strings.noteLocked());
        return;
      }
      const data = content?.data || "";
      if (mode === "new") {
        useEditorStore.getState().newSession({ type: "tiptap", data });
      } else {
        const manager = useEditorManager.getState();
        const editor = manager.activeEditorId
          ? manager.editors[manager.activeEditorId]?.editor
          : undefined;
        editor?.insertContent(data);
      }
      props.onClose(true);
    };

    return (
      <Dialog
        isOpen={true}
        title={strings.templates()}
        width={500}
        onClose={() => props.onClose(false)}
        onOpen={async () => {
          const templateNotebook = db.settings.getTemplateNotebook();
          const templateTag = db.settings.getTemplateTag();
          const selector = templateNotebook
            ? db.relations.from(
                { type: "notebook", id: templateNotebook },
                "note"
              ).selector
            : templateTag
            ? db.relations.from({ type: "tag", id: templateTag }, "note")
                .selector
            : undefined;
          setHasSource(!!selector);
          if (selector)
            setNotes(
              await selector.sorted(db.settings.getGroupOptions("notes"))
            );
          setLoading(false);
        }}
        negativeButton={{
          text: strings.cancel(),
          onClick: () => props.onClose(false)
        }}
        noScroll
      >
        <Flex
          variant="columnFill"
          sx={{ mx: 3, overflow: "hidden", height: 400 }}
        >
          {loading ? null : !hasSource ? (
            <Text variant="body" sx={{ mt: 2, color: "paragraph-secondary" }}>
              {strings.noTemplateSourceSet()}
            </Text>
          ) : !notes || notes.length === 0 ? (
            <Text variant="body" sx={{ mt: 2, color: "paragraph-secondary" }}>
              {strings.noTemplatesFound()}
            </Text>
          ) : (
            <Virtuoso
              data={notes.placeholders}
              components={{ Scroller: CustomScrollbarsVirtualList }}
              style={{ height: "100%", width: "100%" }}
              itemContent={(index) => (
                <div style={{ height: 28 }}>
                  <ResolvedItem items={notes} index={index} type="note">
                    {({ item: note }) => (
                      <Button
                        variant="menuitem"
                        sx={{
                          p: 1,
                          width: "100%",
                          textAlign: "left",
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          borderBottom: "1px solid var(--border)"
                        }}
                        onClick={() => applyTemplate(note)}
                      >
                        <Text variant="body">{note.title}</Text>
                      </Button>
                    )}
                  </ResolvedItem>
                </div>
              )}
            />
          )}
        </Flex>
      </Dialog>
    );
  },
  { onBeforeOpen: () => checkFeature("templates") }
);
