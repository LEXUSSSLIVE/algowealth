import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { fileUrl } from '@/api/config';
import { getPosts, type Post } from '@/api/portfolio';
import { useSession } from '@/auth/session';
import { Header } from '@/components/header';
import { Skeleton } from '@/components/skeleton';
import { formatDateTime } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';
import { colors, font, spacing } from '@/theme/tokens';

const PAGE = 10;

function postCategory(post: Post) {
  return post.type === 'reports' ? 'Reports' : 'Stock ideas';
}

function FeaturedCard({ post, onPress }: { post: Post; onPress: () => void }) {
  return (
    <Pressable style={styles.featured} onPress={onPress}>
      {post.image_path ? (
        <Image source={{ uri: fileUrl(post.image_path) }} style={styles.featuredImage} />
      ) : (
        <View style={[styles.featuredImage, styles.imageFallback]} />
      )}
      <Text style={styles.featuredTitle}>{post.title}</Text>
      <Text style={styles.meta}>
        {postCategory(post)} · {formatDateTime(post.published_at).slice(0, 10)}
      </Text>
    </Pressable>
  );
}

function CompactCard({ post, onPress }: { post: Post; onPress: () => void }) {
  return (
    <Pressable style={styles.compact} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.compactTitle} numberOfLines={2}>{post.title}</Text>
        <Text style={styles.meta}>
          {postCategory(post)} · {formatDateTime(post.published_at).slice(0, 10)}
        </Text>
      </View>
      {post.image_path ? (
        <Image source={{ uri: fileUrl(post.image_path) }} style={styles.compactImage} />
      ) : (
        <View style={[styles.compactImage, styles.imageFallback]} />
      )}
    </Pressable>
  );
}

export default function BlogScreen() {
  const { api } = useSession();
  const { t } = useTranslation();
  const router = useRouter();
  const [type, setType] = useState<'stock_ideas' | 'reports' | undefined>(undefined);
  const [visible, setVisible] = useState(PAGE);

  const posts = useApiData(() => getPosts(api, type, 50), [type]);

  const chips = [
    { key: 'all', label: t('home.chipAll') },
    { key: 'stock_ideas', label: t('home.chipIdeas') },
    { key: 'reports', label: t('home.chipReports') },
  ];

  const all = posts.data ?? [];
  const shown = all.slice(0, visible);
  const [first, ...rest] = shown;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header onSearchPress={() => router.push('/search')} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>{t('tabs.blog')}</Text>
        <View style={styles.chipsRow}>
          {chips.map((c) => {
            const active = (c.key === 'all' && !type) || c.key === type;
            return (
              <Pressable
                key={c.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  setType(c.key === 'all' ? undefined : (c.key as 'stock_ideas' | 'reports'));
                  setVisible(PAGE);
                }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {posts.loading && !posts.data ? (
          <View style={styles.body}>
            <Skeleton style={{ height: 220 }} />
            <Skeleton style={{ height: 72 }} />
            <Skeleton style={{ height: 72 }} />
          </View>
        ) : (
          <View style={styles.body}>
            {first && (
              <FeaturedCard post={first} onPress={() => router.push(`/blog/${first.id}`)} />
            )}
            {rest.map((p) => (
              <CompactCard key={p.id} post={p} onPress={() => router.push(`/blog/${p.id}`)} />
            ))}
            {all.length === 0 && <Text style={styles.empty}>{t('home.noPosts')}</Text>}
            {all.length > visible && (
              <Pressable style={styles.moreBtn} onPress={() => setVisible((v) => v + PAGE)}>
                <Text style={styles.moreText}>{t('blog.showMore')}</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  h1: {
    fontFamily: font.bold,
    fontSize: 26,
    color: colors.textDark,
    paddingHorizontal: spacing(5),
    marginTop: spacing(3),
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing(2),
    paddingHorizontal: spacing(5),
    marginTop: spacing(3),
  },
  chip: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    borderRadius: 18,
    backgroundColor: colors.segmentBg,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontFamily: font.medium, fontSize: 13, color: colors.textDark },
  chipTextActive: { color: '#fff' },
  body: {
    paddingHorizontal: spacing(5),
    paddingTop: spacing(4),
    paddingBottom: spacing(8),
    gap: spacing(3),
  },
  featured: { gap: spacing(2) },
  featuredImage: {
    width: '100%',
    height: 180,
    borderRadius: 20,
    backgroundColor: colors.segmentBg,
  },
  featuredTitle: { fontFamily: font.semibold, fontSize: 18, color: colors.textDark },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(2),
  },
  compactTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.textDark },
  compactImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.segmentBg,
  },
  imageFallback: { backgroundColor: colors.headerLight },
  meta: { fontFamily: font.regular, fontSize: 12, color: colors.textGray, marginTop: 2 },
  empty: { fontFamily: font.regular, fontSize: 14, color: colors.textGray },
  moreBtn: {
    alignSelf: 'center',
    paddingHorizontal: spacing(6),
    paddingVertical: spacing(3),
    borderRadius: 22,
    backgroundColor: colors.segmentBg,
    marginTop: spacing(2),
  },
  moreText: { fontFamily: font.semibold, fontSize: 14, color: colors.textDark },
});
