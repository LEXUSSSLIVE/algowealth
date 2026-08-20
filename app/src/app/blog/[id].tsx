import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, FileText } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { fileUrl } from '@/api/config';
import { getPost, getPosts } from '@/api/portfolio';
import { useSession } from '@/auth/session';
import { PostBlocks } from '@/components/post-blocks';
import { Skeleton } from '@/components/skeleton';
import { formatDateTime } from '@/lib/format';
import { parsePostBlocks } from '@/lib/post-blocks';
import { useApiData } from '@/lib/use-api-data';
import { colors, font, spacing } from '@/theme/tokens';

export default function ArticleScreen() {
  const { api } = useSession();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const postId = Number(params.id);

  const post = useApiData(() => getPost(api, postId), [postId]);
  const related = useApiData(() => getPosts(api, undefined, 4), []);

  const blocks = useMemo(
    () => parsePostBlocks(post.data?.content_json),
    [post.data?.content_json],
  );
  const readMore = (related.data ?? []).filter((p) => p.id !== postId).slice(0, 3);

  const p = post.data;
  const category = p?.type === 'reports' ? 'Reports' : 'Stock ideas';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={24} color={colors.textDark} />
        </Pressable>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        {post.loading && !p ? (
          <>
            <Skeleton style={{ height: 200 }} />
            <Skeleton style={{ height: 28, width: '80%' }} />
            <Skeleton style={{ height: 120 }} />
          </>
        ) : post.error ? (
          <Text style={styles.empty}>{post.error}</Text>
        ) : p ? (
          <>
            {p.image_path && (
              <Image source={{ uri: fileUrl(p.image_path) }} style={styles.cover} />
            )}
            <Text style={styles.title}>{p.title}</Text>
            <Text style={styles.meta}>
              {category} · {formatDateTime(p.published_at).slice(0, 10)}
            </Text>
            <PostBlocks blocks={blocks} />
            {p.file_path && (
              <Pressable
                style={styles.attachment}
                onPress={() => Linking.openURL(fileUrl(p.file_path!))}
              >
                <FileText size={26} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {p.file_path.split('/').pop()}
                  </Text>
                  <Text style={styles.attachmentHint}>{t('blog.openAttachment')}</Text>
                </View>
              </Pressable>
            )}
            {readMore.length > 0 && (
              <View style={{ marginTop: spacing(4), gap: spacing(3) }}>
                <Text style={styles.h2}>{t('blog.readMore')}</Text>
                {readMore.map((r) => (
                  <Pressable
                    key={r.id}
                    style={styles.relatedRow}
                    onPress={() => router.push(`/blog/${r.id}`)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.relatedTitle} numberOfLines={2}>{r.title}</Text>
                      <Text style={styles.meta}>
                        {(r.type === 'reports' ? 'Reports' : 'Stock ideas') +
                          ' · ' + formatDateTime(r.published_at).slice(0, 10)}
                      </Text>
                    </View>
                    {r.image_path ? (
                      <Image source={{ uri: fileUrl(r.image_path) }} style={styles.relatedImage} />
                    ) : (
                      <View style={[styles.relatedImage, styles.imageFallback]} />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { paddingHorizontal: spacing(5), paddingVertical: spacing(3) },
  body: { paddingHorizontal: spacing(5), paddingBottom: spacing(10), gap: spacing(3) },
  cover: {
    width: '100%',
    height: 200,
    borderRadius: 20,
    backgroundColor: colors.segmentBg,
  },
  title: { fontFamily: font.bold, fontSize: 24, lineHeight: 30, color: colors.textDark },
  meta: { fontFamily: font.regular, fontSize: 12, color: colors.textGray },
  empty: { fontFamily: font.regular, fontSize: 14, color: colors.textGray },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(4),
    borderRadius: 16,
    backgroundColor: colors.segmentBg,
    marginTop: spacing(2),
  },
  attachmentName: { fontFamily: font.semibold, fontSize: 14, color: colors.textDark },
  attachmentHint: { fontFamily: font.regular, fontSize: 12, color: colors.textGray, marginTop: 2 },
  h2: { fontFamily: font.bold, fontSize: 20, color: colors.textDark },
  relatedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  relatedTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.textDark },
  relatedImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.segmentBg,
  },
  imageFallback: { backgroundColor: colors.headerLight },
});
