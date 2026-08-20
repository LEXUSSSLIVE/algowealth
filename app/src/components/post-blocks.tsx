import React from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';

import { fileUrl } from '@/api/config';
import type { InlineSpan, PostBlock } from '@/lib/post-blocks';
import { colors, font, spacing } from '@/theme/tokens';

function Spans({ spans, base }: { spans: InlineSpan[]; base: object }) {
  return (
    <Text style={base}>
      {spans.map((s, i) => (
        <Text
          key={i}
          style={[
            s.bold && { fontFamily: font.semibold },
            s.italic && { fontStyle: 'italic' },
            s.link ? { color: colors.primary } : null,
          ]}
          onPress={s.link ? () => Linking.openURL(s.link!) : undefined}
        >
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

const HEADER_STYLE = {
  1: { fontFamily: font.bold, fontSize: 24, lineHeight: 30 },
  2: { fontFamily: font.bold, fontSize: 20, lineHeight: 26 },
  3: { fontFamily: font.semibold, fontSize: 17, lineHeight: 23 },
} as const;

/** Native renderer for editor.js article blocks (SPEC §5.10). */
export function PostBlocks({ blocks }: { blocks: PostBlock[] }) {
  return (
    <View style={styles.wrap}>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'header':
            return (
              <Spans
                key={i}
                spans={block.spans}
                base={[styles.header, HEADER_STYLE[block.level]]}
              />
            );
          case 'paragraph':
            return <Spans key={i} spans={block.spans} base={styles.paragraph} />;
          case 'list':
            return (
              <View key={i} style={styles.list}>
                {block.items.map((item, j) => (
                  <View key={j} style={styles.listRow}>
                    <Text style={styles.listMarker}>
                      {block.ordered ? `${j + 1}.` : '•'}
                    </Text>
                    <Spans spans={item} base={[styles.paragraph, { flex: 1 }]} />
                  </View>
                ))}
              </View>
            );
          case 'image':
            return (
              <View key={i}>
                <Image source={{ uri: fileUrl(block.url) }} style={styles.image} />
                {block.caption ? <Text style={styles.caption}>{block.caption}</Text> : null}
              </View>
            );
          default:
            return null;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing(3) },
  header: { color: colors.textDark, marginTop: spacing(2) },
  paragraph: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textDark,
  },
  list: { gap: spacing(1) },
  listRow: { flexDirection: 'row', gap: spacing(2) },
  listMarker: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textGray,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    backgroundColor: colors.segmentBg,
  },
  caption: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.textGray,
    marginTop: spacing(1),
  },
});
