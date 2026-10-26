package com.kubbonet.segundocerebro.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class TokenManager(context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "sc_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    companion object {
        private const val KEY_ACCESS_TOKEN = "jwt_access_token"
        private const val KEY_REFRESH_TOKEN = "jwt_refresh_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_LOGGED_OUT_EXPLICITLY = "sc_user_explicitly_logged_out"
    }

    fun saveTokens(accessToken: String, refreshToken: String? = null) {
        sharedPreferences.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .apply {
                if (refreshToken != null) putString(KEY_REFRESH_TOKEN, refreshToken)
                putBoolean(KEY_LOGGED_OUT_EXPLICITLY, false)
            }
            .apply()
    }

    fun saveUserData(id: String, email: String, name: String?) {
        sharedPreferences.edit()
            .putString(KEY_USER_ID, id)
            .putString(KEY_USER_EMAIL, email)
            .putString(KEY_USER_NAME, name)
            .apply()
    }

    fun getAccessToken(): String? = sharedPreferences.getString(KEY_ACCESS_TOKEN, null)

    fun getRefreshToken(): String? = sharedPreferences.getString(KEY_REFRESH_TOKEN, null)

    fun getUserEmail(): String? = sharedPreferences.getString(KEY_USER_EMAIL, null)

    fun getUserName(): String? = sharedPreferences.getString(KEY_USER_NAME, null)

    fun isExplicitlyLoggedOut(): Boolean = sharedPreferences.getBoolean(KEY_LOGGED_OUT_EXPLICITLY, false)

    fun clear() {
        sharedPreferences.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .remove(KEY_USER_ID)
            .remove(KEY_USER_EMAIL)
            .remove(KEY_USER_NAME)
            .putBoolean(KEY_LOGGED_OUT_EXPLICITLY, true)
            .apply()
    }
}
