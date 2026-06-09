package it.mauriziotavilla.offertelavoro;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@CapacitorPlugin(name = "OfferteNotifications")
public class OfferteNotificationsPlugin extends Plugin {
    private static final String PREFS = "offerte_notifications";
    private static final String KEY_TOPICS = "topics";

    @PluginMethod
    public void getTopics(PluginCall call) {
        Set<String> topics = new HashSet<>(prefs().getStringSet(KEY_TOPICS, new HashSet<>()));
        JSObject result = new JSObject();
        result.put("topics", new JSArray(new ArrayList<>(topics)));
        call.resolve(result);
    }

    @PluginMethod
    public void syncTopics(PluginCall call) {
        JSArray requested = call.getArray("topics", new JSArray());
        Set<String> nextTopics = sanitizeTopics(requested);
        Set<String> currentTopics = new HashSet<>(prefs().getStringSet(KEY_TOPICS, new HashSet<>()));

        List<Task<Void>> tasks = new ArrayList<>();
        List<String> subscribed = new ArrayList<>();
        List<String> unsubscribed = new ArrayList<>();

        for (String topic : nextTopics) {
            if (!currentTopics.contains(topic)) {
                tasks.add(FirebaseMessaging.getInstance().subscribeToTopic(topic));
                subscribed.add(topic);
            }
        }

        for (String topic : currentTopics) {
            if (!nextTopics.contains(topic)) {
                tasks.add(FirebaseMessaging.getInstance().unsubscribeFromTopic(topic));
                unsubscribed.add(topic);
            }
        }

        if (tasks.isEmpty()) {
          saveTopics(nextTopics);
          call.resolve(buildResult(nextTopics, subscribed, unsubscribed));
          return;
        }

        Tasks.whenAllComplete(tasks).addOnCompleteListener(task -> {
            for (Task<?> item : tasks) {
                if (!item.isSuccessful()) {
                    String message = item.getException() != null ? item.getException().getMessage() : "Errore topic Firebase";
                    call.reject(message);
                    return;
                }
            }

            saveTopics(nextTopics);
            call.resolve(buildResult(nextTopics, subscribed, unsubscribed));
        });
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private void saveTopics(Set<String> topics) {
        prefs().edit().putStringSet(KEY_TOPICS, new HashSet<>(topics)).apply();
    }

    private JSObject buildResult(Set<String> topics, List<String> subscribed, List<String> unsubscribed) {
        JSObject result = new JSObject();
        result.put("topics", new JSArray(new ArrayList<>(topics)));
        result.put("subscribed", new JSArray(subscribed));
        result.put("unsubscribed", new JSArray(unsubscribed));
        return result;
    }

    private Set<String> sanitizeTopics(JSArray input) {
        Set<String> topics = new HashSet<>();
        for (int i = 0; i < input.length(); i++) {
            try {
                String raw = input.getString(i);
                if (raw == null) continue;
                String sanitized = raw.toLowerCase().replaceAll("[^a-z0-9-_]", "_").replaceAll("_+", "_").replaceAll("^_+|_+$", "");
                if (!sanitized.isEmpty()) {
                    topics.add(sanitized);
                }
            } catch (JSONException ignored) {
            }
        }
        return topics;
    }
}
