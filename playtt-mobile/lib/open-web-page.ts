import * as WebBrowser from "expo-web-browser"
import { Linking } from "react-native"

/** Open a public page (privacy policy, terms) in an in-app browser sheet. */
export async function openWebPage(url: string) {
  try {
    await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET })
  } catch {
    await Linking.openURL(url).catch(() => undefined)
  }
}
