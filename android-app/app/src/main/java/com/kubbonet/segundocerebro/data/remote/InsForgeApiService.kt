package com.kubbonet.segundocerebro.data.remote

import com.kubbonet.segundocerebro.data.local.TokenManager
import com.kubbonet.segundocerebro.data.model.*
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.*
import io.ktor.http.ContentType
import io.ktor.http.contentType

class InsForgeApiService(
    private val client: HttpClient,
    private val tokenManager: TokenManager
) {
    private val baseUrl = InsForgeApiConfig.BASE_URL

    // ==========================================
    // AUTENTICACIÓN
    // ==========================================

    suspend fun signIn(identifier: String, pass: String): AuthResponse {
        val email = InsForgeApiConfig.normalizeUserIdentifier(identifier)
        val response: AuthResponse = client.post("$baseUrl/auth/v1/token?grant_type=password") {
            contentType(ContentType.Application.Json)
            setBody(SignInRequest(email = email, password = pass))
        }.body()

        val token = response.session?.accessToken ?: response.accessToken
        val user = response.session?.user ?: response.user
        if (!token.isNullOrBlank()) {
            tokenManager.saveTokens(token, response.session?.refreshToken ?: response.refreshToken)
            if (user != null) {
                tokenManager.saveUserData(user.id, user.email, user.name)
            }
        }
        return response
    }

    suspend fun signUp(identifier: String, pass: String, name: String? = null): AuthResponse {
        val email = InsForgeApiConfig.normalizeUserIdentifier(identifier)
        val displayName = name ?: if (identifier.contains("@")) identifier.substringBefore("@") else identifier
        val response: AuthResponse = client.post("$baseUrl/auth/v1/signup") {
            contentType(ContentType.Application.Json)
            setBody(SignUpRequest(email = email, password = pass, name = displayName))
        }.body()

        val token = response.session?.accessToken ?: response.accessToken
        val user = response.session?.user ?: response.user
        if (!token.isNullOrBlank()) {
            tokenManager.saveTokens(token, response.session?.refreshToken ?: response.refreshToken)
            if (user != null) {
                tokenManager.saveUserData(user.id, user.email, user.name)
            }
        }
        return response
    }

    suspend fun getCurrentUser(): AuthUser? {
        return try {
            client.get("$baseUrl/auth/v1/user").body()
        } catch (e: Exception) {
            null
        }
    }

    fun signOut() {
        tokenManager.clear()
    }

    // ==========================================
    // CUADERNOS & NOTAS (PostgREST /rest/v1)
    // ==========================================

    suspend fun getNotebooks(includeArchived: Boolean = false): List<AppNotebook> {
        val url = "$baseUrl/rest/v1/app_notebooks?select=*&order=order_index.asc,created_at.asc" +
                if (!includeArchived) "&is_archived=eq.false" else ""
        return client.get(url).body()
    }

    suspend fun createNotebook(notebook: AppNotebook): List<AppNotebook> {
        return client.post("$baseUrl/rest/v1/app_notebooks") {
            contentType(ContentType.Application.Json)
            header("Prefer", "return=representation")
            setBody(listOf(notebook))
        }.body()
    }

    suspend fun getNotes(notebookId: String? = null, isFavorite: Boolean? = null): List<AppNote> {
        var url = "$baseUrl/rest/v1/app_notes?select=*&order=is_pinned.desc,updated_at.desc"
        if (notebookId != null) url += "&notebook_id=eq.$notebookId"
        if (isFavorite == true) url += "&is_favorite=eq.true"
        return client.get(url).body()
    }

    suspend fun createNote(note: AppNote): List<AppNote> {
        return client.post("$baseUrl/rest/v1/app_notes") {
            contentType(ContentType.Application.Json)
            header("Prefer", "return=representation")
            setBody(listOf(note))
        }.body()
    }

    suspend fun updateNote(id: String, note: AppNote): List<AppNote> {
        return client.patch("$baseUrl/rest/v1/app_notes?id=eq.$id") {
            contentType(ContentType.Application.Json)
            header("Prefer", "return=representation")
            setBody(note)
        }.body()
    }

    suspend fun deleteNote(id: String) {
        client.delete("$baseUrl/rest/v1/app_notes?id=eq.$id")
    }

    // ==========================================
    // TAREAS (Kanban / ClickUp)
    // ==========================================

    suspend fun getTasks(): List<AppTask> {
        return client.get("$baseUrl/rest/v1/app_tasks?select=*&order=order_index.asc,created_at.desc").body()
    }

    suspend fun createTask(task: AppTask): List<AppTask> {
        return client.post("$baseUrl/rest/v1/app_tasks") {
            contentType(ContentType.Application.Json)
            header("Prefer", "return=representation")
            setBody(listOf(task))
        }.body()
    }

    suspend fun updateTask(id: String, task: AppTask): List<AppTask> {
        return client.patch("$baseUrl/rest/v1/app_tasks?id=eq.$id") {
            contentType(ContentType.Application.Json)
            header("Prefer", "return=representation")
            setBody(task)
        }.body()
    }

    suspend fun deleteTask(id: String) {
        client.delete("$baseUrl/rest/v1/app_tasks?id=eq.$id")
    }

    // ==========================================
    // PROYECTOS & ÁREAS (PARA)
    // ==========================================

    suspend fun getProjects(): List<AppProject> {
        return client.get("$baseUrl/rest/v1/app_projects?select=*&order=created_at.desc").body()
    }

    suspend fun createProject(project: AppProject): List<AppProject> {
        return client.post("$baseUrl/rest/v1/app_projects") {
            contentType(ContentType.Application.Json)
            header("Prefer", "return=representation")
            setBody(listOf(project))
        }.body()
    }

    suspend fun getAreas(): List<AppArea> {
        return client.get("$baseUrl/rest/v1/app_areas?select=*&order=order_index.asc,created_at.asc").body()
    }

    // ==========================================
    // HÁBITOS & LOGS
    // ==========================================

    suspend fun getHabits(includeArchived: Boolean = false): List<AppHabit> {
        val url = "$baseUrl/rest/v1/app_habits?select=*&order=order_index.asc,created_at.asc" +
                if (!includeArchived) "&is_archived=eq.false" else ""
        return client.get(url).body()
    }

    suspend fun getHabitLogs(startDate: String? = null, endDate: String? = null): List<AppHabitLog> {
        var url = "$baseUrl/rest/v1/app_habit_logs?select=*&order=date.desc"
        if (startDate != null) url += "&date=gte.$startDate"
        if (endDate != null) url += "&date=lte.$endDate"
        return client.get(url).body()
    }

    suspend fun recordHabitLog(log: AppHabitLog): List<AppHabitLog> {
        return client.post("$baseUrl/rest/v1/app_habit_logs") {
            contentType(ContentType.Application.Json)
            header("Prefer", "return=representation,resolution=merge-duplicates")
            setBody(listOf(log))
        }.body()
    }

    // ==========================================
    // RECORDATORIOS & OBJETOS
    // ==========================================

    suspend fun getReminders(): List<AppReminder> {
        return client.get("$baseUrl/rest/v1/app_reminders?select=*&order=remind_at.asc").body()
    }

    suspend fun getObjects(): List<AppObject> {
        return client.get("$baseUrl/rest/v1/app_objects?select=*&order=created_at.desc").body()
    }
}
