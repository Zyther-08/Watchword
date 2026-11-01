# Watchword lock for Windows

Any browser extension can be removed in two clicks, and no extension can stop that by itself. These files use Windows' own policy settings, the ones schools and workplaces use, to keep Watchword installed in Edge and Firefox, with the Remove and Turn off buttons gone.

**[Download the lock files](watchword-windows-lock.zip)** (a zip with the lock file, the unlock file and instructions).

## How to use it

```
Any browser extension can be removed in two clicks, and no extension can stop that by itself.
This lock uses Windows' own settings, the ones schools and workplaces use, to keep Watchword
installed. Anyone can read exactly what it changes: open the .reg files in Notepad.


WHAT IT DOES
- Edge installs Watchword from the Edge Add-ons store and keeps it there. The Remove and
  Turn off buttons disappear, and Edge says it is "managed by your organization". That is
  normal: here, the organization is you.
- Firefox does the same, if it is installed.
- InPrivate windows, Edge guest mode and Firefox Private Browsing are switched off, so there
  is no window without Watchword.
- Firefox Troubleshoot Mode, which starts Firefox with all add-ons off, is switched off.
- Edge greys out its own secure DNS setting and uses the computer's DNS instead. That is
  expected, and it means Edge follows the family filter from "Protect every device".


BEFORE YOU START
1. Install Watchword from the Edge Add-ons or Firefox Add-ons store. If you already have it
   from a store, keep it: the lock takes that copy over, settings and all.
2. If you have a copy loaded from a folder (a test copy), remove it on the extensions page and
   turn off Developer mode. Test copies can't be locked.
3. Set up the computer's family filter from "Protect every device" on Watchword's settings
   page. Do it now, because after Step 2 changing it needs the other person's password.


STEP 1: Apply the lock (while your account is still an administrator)
1. Double-click "Watchword lock.reg". Windows asks twice whether you are sure: click Yes, Yes, OK.
2. Close the browser completely and open it again. Watchword installs itself within a minute
   or two if it wasn't installed already.
3. Check it worked: the top of Watchword's settings page now says "Watchword can't be removed",
   and the extensions page shows no Remove button.
4. Add your word packs and words, and lock the settings with the typing challenge.


STEP 2: Hand over the key (this is what makes it a real lock)
Right now you are an administrator, so you could run the unlock file yourself. This step
gives that power to someone you trust instead.
1. Settings > Accounts > Other users > Add account.
2. Choose "I don't have this person's sign-in information", then
   "Add a user without a Microsoft account".
3. Name it, for example "Keeper", and let the person you trust type the password.
   Don't watch, and don't write it down.
4. Back in Other users, select Keeper > Change account type > Administrator > OK.
5. Sign out. The person you trust signs in as Keeper, opens Settings > Accounts > Other users,
   selects YOUR account > Change account type > Standard User > OK, then signs out.
6. Sign back in to your own account as usual.
From now on, anything that changes the lock asks for the Keeper password, which only the
person you trust knows.


UNLOCKING
"Watchword unlock.reg" removes all of this. Give it to the person you trust, or simply delete
it: it can always be downloaded again, and running it needs the Keeper password.
Unlocking also uninstalls the store copy of Watchword in Edge, together with its settings.


HONEST LIMITS
- The lock covers Edge and Firefox. While you are still an administrator, uninstall any other
  browsers you don't need.
- A standard account can still install some browsers just for itself. The computer's family
  filter from "Protect every device" covers those, plus apps and the rest of the computer.
- The lock is for Windows only.
```

## Exactly what the lock changes

Watchword lock.reg:

```reg
Windows Registry Editor Version 5.00

; Watchword lock. Keeps Watchword installed in Edge and Firefox, and turns off
; the windows where it can't run: InPrivate, guest mode, Private Browsing and
; Firefox's Troubleshoot Mode. Remove it with "Watchword unlock.reg".

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist]
"1"="pipfphkomoddfipkgphhikmehohgmiog;https://edge.microsoft.com/extensionwebstorebase/v1/crx"

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Edge]
"InPrivateModeAvailability"=dword:00000001
"BrowserGuestModeEnabled"=dword:00000000

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Mozilla\Firefox]
"ExtensionSettings"=(the JSON below, stored as a multi-line string)
"PrivateBrowsingModeAvailability"=dword:00000001
"DisablePrivateBrowsing"=dword:00000001
"DisableSafeMode"=dword:00000001
```

The Firefox `ExtensionSettings` value is this JSON:

```json
{
  "watchword@local.extension": {
    "installation_mode": "force_installed",
    "install_url": "https://addons.mozilla.org/firefox/downloads/latest/watchword@local.extension/latest.xpi",
    "private_browsing": true
  }
}
```

Watchword unlock.reg removes every one of these values again:

```reg
Windows Registry Editor Version 5.00

; Watchword unlock. Removes everything "Watchword lock.reg" added.
; Edge then uninstalls its store copy of Watchword, together with its settings.

[-HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist]

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Edge]
"InPrivateModeAvailability"=-
"BrowserGuestModeEnabled"=-

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Mozilla\Firefox]
"ExtensionSettings"=-
"PrivateBrowsingModeAvailability"=-
"DisablePrivateBrowsing"=-
"DisableSafeMode"=-
```
