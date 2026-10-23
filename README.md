# Watchword

Closes the tab when someone searches for a word you've blocked, on Google, Bing, DuckDuckGo, YouTube, Yahoo and most site search boxes.

- **Whole words only.** Blocking "ass" never touches "pass", "class" or a link like `.../provpass.pdf`. Only what was *searched for* is checked, never the rest of a web address.
- **Hard to sneak past.** `b.all`, `b  all`, `b.a.l.l`, `b.a.ll`, `b_all`, `b?all`, `B-A-L-L`, `b4ll`, `8all`, `ｂａｌｌ`, `bàll`, and letters swapped for look-alikes from other alphabets all count as "ball", and so do words broken into pieces with misspellings, like "as . yhole" or "a s s y h o l e". Plurals ("balls") are caught too, and so are spelled-out letters like "nystroem" for "nyström".
- **Misspellings, when you want them.** Click ≈ on a word to also catch misspellings: "cuomshot", "comshot" and "cumhsot" all count as "cumshot". Words of 5 to 8 letters allow 1 wrong letter, longer words and phrases allow 2. On words under 5 letters, ≈ only catches repeated letters ("nsfww" for "nsfw"), because changing a letter would turn "porn" into "pork". It's off by default because even on longer words one letter can change the meaning ("boobs" and "books"). The **≈ on for all** and **≈ off for all** buttons above the list switch it for every word at once.
- **Closes while typing** in a search box, before Enter is pressed (it waits for the word to finish, so "ass" doesn't fire on the way to "assignment").
- **Word packs** you can add with one click: porn and explicit terms, sex acts, fetishes and kinks, erotic stories, audio and fan fiction (including softer words like “spicy books” or “steamy romance”, and the main erotic story and audio apps), crude slang (including stand-ins like “juicy ahh” or “eating her bum”, and body-shape slang like “caked up girl”), porn sites (their names *and* the sites themselves), suggestive content, and words with everyday meanings too. The last two are off by default, since they also catch normal searches like "sex education".
- **Help searches get through**: a fixed list, shown on the settings page, lets searches like "how to quit porn" or "porn addiction help" through, while any other blocked word in the same search still closes the tab. The list can't be added to, so it can never become a way around the blocked words. It can be switched off and on freely, since the list is fixed and can't be changed.
- **Blocked sites list**, **forced SafeSearch** (Google, Bing, DuckDuckGo) and **YouTube Restricted Mode**.
- **Turn off image search** (optional): the Images tab on Google, Bing, DuckDuckGo, Yahoo, Brave, Ecosia and Yandex goes to the normal results for the same search instead, before the page shows. Pictures on ordinary websites aren't affected. Turning it off needs unlocking, but a 10-minute pass opens image search after a 2-minute wait on the settings page, then closes it again by itself.
- **Optional lock**, in one of two ways. Once locked, nobody can remove blocked words or sites, turn off ≈, or switch off a protection without unlocking; adding new words and sites always works.
  - **Typing challenge (to lock yourself):** unlocking means typing about 10, 20 or 30 minutes of fresh random text by hand, in one sitting. Pasting doesn't work, the text is new every time, and a minute without typing (or leaving the page) starts over. There's nothing to write down or keep, so there's no way to let yourself back in early.
  - **Password (only if someone else holds it):** use this only when a person you trust sets and keeps the password, so you never know it. A password you set yourself isn't a real lock, since you could copy it or undo it and use it in a weak moment.
- Free, no account, nothing sent anywhere. See the [privacy policy](PRIVACY.md).

Open the settings by clicking the toolbar icon. The **Try it** box shows exactly what would be caught.

**Protect every device**, linked at the top of the settings page, has step-by-step guides for the rest: filtering the whole Windows computer and its browsers, Android phones, iPhones and the home router, using Cloudflare's free family filter, plus optional NextDNS steps that turn off GIF search in Messages and phone keyboards. They're built into Watchword, so they work offline and never send you to a video site.

---

## Install

- **Microsoft Edge:** [Watchword on Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/watchword-search-filter/pipfphkomoddfipkgphhikmehohgmiog)
- **Firefox:** [Watchword on Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/watchword/)

Store copies update by themselves. To make Watchword work in private windows, open its details on the extensions page and allow it in InPrivate (Edge) or set **Run in Private Windows** to **Allow** (Firefox, under `about:addons`).

The steps below are for running it from the source files instead, for example in Chrome or another Chromium browser.

## Install from source on Chrome or Edge

1. Unzip this folder somewhere it will stay. Right-click the zip, choose **Extract All**, and make sure the path ends in `\watchword` (for example `C:\Users\you\Documents\watchword`), otherwise the files land loose in Documents. If the folder is moved or deleted later, the extension stops working.
2. Go to `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
3. Turn on **Developer mode** (top right in Chrome, left sidebar in Edge).
4. Click **Load unpacked** and choose the unzipped folder (the one containing `manifest.json`).
5. To make it work in private windows: click **Details** on Watchword and turn on **Allow in Incognito** (Chrome) or **Allow in InPrivate** (Edge).

The same steps work in Brave, Opera, Vivaldi and other Chromium browsers.

## Install from source on Firefox

Firefox only keeps extensions permanently if Mozilla has signed them. Signing is free:

1. Make a free account at https://addons.mozilla.org/developers/
2. Choose **Submit a New Add-on**, then **On your own** (this keeps it private, not listed in the store).
3. Upload the zip file. After the automatic check, download the signed `.xpi` file.
4. Drag the `.xpi` into Firefox and click **Add**.
5. Open `about:addons`, click Watchword, and set **Run in Private Windows** to **Allow**.

To just try it first: go to `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, and pick `manifest.json`. It's removed when Firefox restarts.

If the settings page shows a banner asking for access, click **Allow access**.

## Updating to a new version

Your blocked words and settings are kept as long as you don't remove the extension. Store copies update by themselves; these steps are for copies installed from source.

- **Chrome or Edge:** extract the new zip into the *same* watchword folder and replace the old files, then click the reload arrow under Watchword on the extensions page.
- **Firefox:** sign the new version the same way and install the new `.xpi` over the old one. Bump the version number in `manifest.json` first, because Mozilla won't sign the same version twice.

---

## Good to know

**It's a speed bump, not a wall.** Any browser extension can be switched off from the extensions page, and a different browser won't have it at all. For stronger protection, add one of these as well:

- **A family DNS filter**, which blocks adult and malicious sites for every browser and app. Cloudflare's is free: set the browser's *secure DNS* setting to `https://family.cloudflare-dns.com/dns-query`, or set the computer's or router's DNS to `1.1.1.3` and `1.0.0.3`. Doing it on the router covers every device on the network.
- **The browser's built-in malware protection**, which is on by default: Microsoft Defender SmartScreen in Edge, Safe Browsing in Chrome, and "Block dangerous and deceptive content" in Firefox.
- **Microsoft Family Safety** (Windows and Edge) if this is for a child's account.

**If a normal search gets caught**, use the Try it box to see why, then turn off the matching rule under *How strict*. The usual cause is "Catch words split by spaces": very occasionally two short words next to each other spell a blocked word.

**What isn't checked:** text typed into the browser's own address bar before Enter (extensions can't see it), and the contents of pages. Once Enter is pressed the search is checked as normal.

---

## About

Watchword is designed and maintained by the Watchword Project. The code was written with Claude, Anthropic's AI, and every feature, test case and fix came from real use and feedback.

It's free and open source under the [MIT License](LICENSE). Problems and ideas are welcome as GitHub issues.
