package com.kubbonet.segundocerebro.data.remote

import com.kubbonet.segundocerebro.data.local.TokenManager
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.DefaultRequest
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.request.header
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import java.util.concurrent.TimeUnit

object InsForgeApiConfig {
    const val BASE_URL = "https://insforge.kora.ovh"
    const val ANON_KEY = "anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba"
    const val STORAGE_BUCKET = "app-storage"

    fun normalizeUserIdentifier(input: String): String {
        val clean = input.trim()
        if (clean.isEmpty()) return clean
        if (clean.contains("@")) return clean.lowercase()
        val safeUsername = clean.lowercase().replace(Regex("[^a-z0-9_.-]"), "")
        return "$safeUsername@segundocerebro.local"
    }

    fun createKtorClient(tokenManager: TokenManager): HttpClient {
        return HttpClient(OkHttp) {
            engine {
                config {
                    connectTimeout(30, TimeUnit.SECONDS)
                    readTimeout(60, TimeUnit.SECONDS)
                    writeTimeout(60, TimeUnit.SECONDS)
                }
            }

            install(ContentNegotiation) {
                json(Json {
                    ignoreUnknownKeys = true
                    isLenient = true
                    encodeDefaults = true
                    prettyPrint = false
                })
            }

            install(Logging) {
                level = LogLevel.INFO
            }

            install(DefaultRequest) {
                header("apikey", ANON_KEY)
                val token = tokenManager.getAccessToken()
                if (!token.isNullOrBlank()) {
                    header("Authorization", "Bearer $token")
                } else {
                    header("Authorization", "Bearer $ANON_KEY")
                }
            }
        }
    }
}
