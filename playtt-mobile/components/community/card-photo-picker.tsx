import * as ImagePicker from "expo-image-picker"
import { useState } from "react"
import { StyleSheet, View } from "react-native"

import { Button } from "@/components/ui/button"
import { PlayTTSpacing } from "@/constants/playtt-tokens"
import { useProductTheme } from "@/hooks/use-product-theme"
import { toast } from "@/lib/toast"
import { removeAvatar, uploadAvatar, type AvatarContentType } from "@/lib/user-api"

const ALLOWED_TYPES: AvatarContentType[] = ["image/jpeg", "image/png", "image/webp"]

type CardPhotoPickerProps = {
  hasPhoto: boolean
  onChange: (image: string | null) => void
}

/** Pick a photo from the library and upload it as the card / profile picture (stored in R2). */
export function CardPhotoPicker({ hasPhoto, onChange }: CardPhotoPickerProps) {
  const theme = useProductTheme()
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null)

  async function pick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      toast.error("Allow photo access in Settings to add a card photo.")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 4],
      // Below 1 makes iOS export JPEG instead of HEIC, and keeps uploads small.
      quality: 0.8,
    })
    const asset = result.canceled ? null : result.assets[0]
    if (!asset) return

    const contentType = (asset.mimeType ?? "image/jpeg") as AvatarContentType
    if (!ALLOWED_TYPES.includes(contentType)) {
      toast.error("Use a JPEG, PNG or WebP photo.")
      return
    }

    setBusy("upload")
    try {
      onChange(await uploadAvatar(asset.uri, contentType))
      toast.success("Card photo updated.")
    } catch (error) {
      toast.apiError(error, "Could not upload your photo.")
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    setBusy("remove")
    try {
      await removeAvatar()
      onChange(null)
    } catch (error) {
      toast.apiError(error, "Could not remove your photo.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <View style={styles.row}>
      <View style={styles.grow}>
        <Button
          label={hasPhoto ? "Change photo" : "Add photo"}
          variant="outline"
          surface="product"
          productTheme={theme}
          loading={busy === "upload"}
          disabled={busy !== null}
          onPress={pick}
        />
      </View>
      {hasPhoto ? (
        <View style={styles.grow}>
          <Button
            label="Remove"
            variant="ghost"
            surface="product"
            productTheme={theme}
            loading={busy === "remove"}
            disabled={busy !== null}
            onPress={remove}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: PlayTTSpacing.sm,
  },
  grow: {
    flex: 1,
  },
})
