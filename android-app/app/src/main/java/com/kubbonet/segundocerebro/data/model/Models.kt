package com.kubbonet.segundocerebro.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AppNotebook(
    val id: String,
    @SerialName("user_id") val userId: String? = null,
    val name: String,
    val description: String? = null,
    @SerialName("cover_url") val coverUrl: String? = null,
    @SerialName("cover_type") val coverType: String = "gallery",
    val color: String = "#3b82f6",
    @SerialName("order_index") val orderIndex: Int = 0,
    @SerialName("is_default") val isDefault: Boolean = false,
    @SerialName("is_archived") val isArchived: Boolean = false,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
    @SerialName("notes_count") val notesCount: Int? = null
)

@Serializable
data class AppNote(
    val id: String,
    @SerialName("notebook_id") val notebookId: String? = null,
    val title: String,
    val content: String = "",
    @SerialName("plain_text") val plainText: String? = null,
    val summary: String? = null,
    @SerialName("project_id") val projectId: String? = null,
    @SerialName("area_id") val areaId: String? = null,
    @SerialName("para_category") val paraCategory: String? = null, // project, area, resource, archive, inbox
    val category: String? = null,
    val tags: List<String> = emptyList(),
    @SerialName("is_pinned") val isPinned: Boolean = false,
    @SerialName("is_archived") val isArchived: Boolean = false,
    @SerialName("is_favorite") val isFavorite: Boolean = false,
    val color: String? = null,
    val icon: String? = null,
    @SerialName("note_type") val noteType: String = "text", // text, image, audio, tasks, file, link
    @SerialName("thumbnail_url") val thumbnailUrl: String? = null,
    @SerialName("audio_url") val audioUrl: String? = null,
    @SerialName("audio_duration") val audioDuration: Double? = null,
    @SerialName("audio_transcription") val audioTranscription: String? = null,
    @SerialName("audio_transcription_status") val audioTranscriptionStatus: String? = "none",
    @SerialName("reminder_at") val reminderAt: String? = null,
    @SerialName("reminder_status") val reminderStatus: String? = "none",
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
data class AppTask(
    val id: String,
    val title: String,
    val description: String? = null,
    val status: String = "todo", // todo, in_progress, in_review, completed, cancelled
    val priority: String = "medium", // low, medium, high, urgent
    val eisenhower: String? = "none", // none, do, schedule, delegate, delete
    @SerialName("category_id") val categoryId: String? = null,
    @SerialName("due_date") val dueDate: String? = null,
    @SerialName("scheduled_date") val scheduledDate: String? = null,
    @SerialName("project_id") val projectId: String? = null,
    @SerialName("area_id") val areaId: String? = null,
    @SerialName("para_category") val paraCategory: String? = null,
    @SerialName("note_id") val noteId: String? = null,
    @SerialName("lista_id") val listaId: Long? = null,
    @SerialName("order_index") val orderIndex: Int = 0,
    @SerialName("parent_task_id") val parentTaskId: String? = null,
    val tags: List<String> = emptyList(),
    @SerialName("completed_at") val completedAt: String? = null,
    val url: String? = null,
    @SerialName("thumbnail_url") val thumbnailUrl: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
data class AppProject(
    val id: String,
    val title: String,
    val description: String? = null,
    val status: String = "active", // planning, active, on_hold, completed, cancelled
    val priority: String = "medium",
    val color: String? = null,
    val icon: String? = null,
    @SerialName("start_date") val startDate: String? = null,
    @SerialName("due_date") val dueDate: String? = null,
    val progress: Int = 0,
    val tags: List<String> = emptyList(),
    @SerialName("area_id") val areaId: String? = null,
    @SerialName("is_archived") val isArchived: Boolean = false,
    @SerialName("para_category") val paraCategory: String? = null,
    @SerialName("next_action") val nextAction: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
data class AppArea(
    val id: String,
    val title: String,
    val description: String? = null,
    val color: String? = null,
    val icon: String? = null,
    @SerialName("order_index") val orderIndex: Int = 0,
    @SerialName("review_frequency_days") val reviewFrequencyDays: Int = 7,
    @SerialName("last_reviewed_at") val lastReviewedAt: String? = null,
    @SerialName("next_review_at") val nextReviewAt: String? = null,
    @SerialName("is_archived") val isArchived: Boolean = false,
    val objectives: List<String> = emptyList(),
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
data class AppHabit(
    val id: String,
    val title: String,
    val description: String? = null,
    val icon: String? = null,
    val color: String? = null,
    val frequency: String = "daily", // daily, weekdays, weekends, custom
    @SerialName("frequency_days") val frequencyDays: List<Int> = listOf(1, 2, 3, 4, 5, 6, 7),
    @SerialName("target_per_day") val targetPerDay: Int? = 1,
    @SerialName("start_date") val startDate: String,
    @SerialName("end_date") val endDate: String? = null,
    @SerialName("reminder_time") val reminderTime: String? = null,
    @SerialName("is_archived") val isArchived: Boolean = false,
    @SerialName("order_index") val orderIndex: Int = 0,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
data class AppHabitLog(
    val id: String,
    @SerialName("habit_id") val habitId: String,
    val date: String, // YYYY-MM-DD
    val status: String, // completed, skipped
    val notes: String? = null,
    @SerialName("completed_at") val completedAt: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
data class AppReminder(
    val id: String,
    @SerialName("user_id") val userId: String? = null,
    @SerialName("note_id") val noteId: String? = null,
    @SerialName("task_id") val taskId: String? = null,
    @SerialName("person_id") val personId: String? = null,
    val title: String,
    val description: String? = null,
    @SerialName("remind_at") val remindAt: String,
    val timezone: String? = null,
    val status: String = "pending", // pending, completed, dismissed
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
data class AppAttachment(
    val id: String,
    @SerialName("entity_id") val entityId: String,
    @SerialName("entity_type") val entityType: String,
    @SerialName("file_name") val fileName: String,
    @SerialName("display_name") val displayName: String? = null,
    @SerialName("file_url") val fileUrl: String,
    @SerialName("file_path") val filePath: String,
    @SerialName("r2_key") val r2Key: String? = null,
    @SerialName("bucket_name") val bucketName: String = "app-storage",
    @SerialName("storage_provider") val storageProvider: String = "insforge",
    @SerialName("folder_id") val folderId: String? = null,
    @SerialName("file_size") val fileSize: Long? = null,
    @SerialName("mime_type") val mimeType: String? = null,
    @SerialName("is_favorite") val isFavorite: Boolean = false,
    val tags: List<String> = emptyList(),
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
data class AppObject(
    val id: String,
    @SerialName("object_type") val objectType: String, // person, company, page, meeting, book, concept, custom
    val title: String,
    val description: String? = null,
    val content: String? = null,
    @SerialName("project_id") val projectId: String? = null,
    @SerialName("area_id") val areaId: String? = null,
    @SerialName("para_category") val paraCategory: String? = null,
    val tags: List<String> = emptyList(),
    val color: String? = null,
    val icon: String? = null,
    @SerialName("thumbnail_url") val thumbnailUrl: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
data class AppLink(
    val id: String,
    @SerialName("from_id") val fromId: String,
    @SerialName("from_type") val fromType: String,
    @SerialName("to_id") val toId: String,
    @SerialName("to_type") val toType: String,
    @SerialName("relation_label") val relationLabel: String = "related",
    @SerialName("created_at") val createdAt: String? = null
)
