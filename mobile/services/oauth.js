export const signInWithProvider = async (provider) => {
  const authUrl = `${API_URL}/auth/${provider}?platform=mobile`;

  let settled = false;
  let subscription = null;

  return new Promise((resolve, reject) => {
    const finish = (fn) => {
      if (settled) return;

      settled = true;

      if (subscription) {
        subscription.remove();
        subscription = null;
      }

      WebBrowser.dismissBrowser();
      fn();
    };

    const handleUrl = (url) => {
      if (!url || !url.startsWith(REDIRECT_URL)) return;

      finish(() => {
        try {
          resolve(parseCallbackUrl(url));
        } catch (err) {
          reject(err);
        }
      });
    };

    // Listen BEFORE opening the browser.
    subscription = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url);
    });

    // Android can deliver the OAuth callback as the app's initial URL
    // instead of firing the "url" event.
    Linking.getInitialURL()
      .then((initialUrl) => {
        if (initialUrl) {
          handleUrl(initialUrl);
        }
      })
      .catch(() => {});

    WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URL)
      .then((result) => {
        if (settled) return;

        if (result.type === "success" && result.url) {
          handleUrl(result.url);
          return;
        }

        // Android Custom Tabs can report "dismiss" even after
        // the OAuth redirect was successfully delivered.
        setTimeout(() => {
          if (!settled) {
            finish(() => resolve(null));
          }
        }, 2000);
      })
      .catch((err) => {
        if (!settled) {
          finish(() => reject(err));
        }
      });
  });
};