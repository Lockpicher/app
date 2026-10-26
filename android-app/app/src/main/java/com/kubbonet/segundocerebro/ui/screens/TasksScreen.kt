package com.kubbonet.segundocerebro.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kubbonet.segundocerebro.data.model.AppTask
import com.kubbonet.segundocerebro.ui.theme.*
import com.kubbonet.segundocerebro.viewmodel.MainViewModel

@Composable
fun TasksScreen(viewModel: MainViewModel) {
    val tasks by viewModel.tasks.collectAsState()
    var showNewTaskDialog by remember { mutableStateOf(false) }
    var newTaskTitle by remember { mutableStateOf("") }

    val columns = listOf(
        Triple("Por hacer", "todo", AccentBlue),
        Triple("En progreso", "in_progress", AccentAmber),
        Triple("En revisión", "in_review", AccentPurple),
        Triple("Completada", "completed", AccentGreen)
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .windowInsetsPadding(WindowInsets.statusBars)
    ) {
        // Cabecera limpia sin barra duplicada
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Tablero Kanban",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = "Desplaza horizontalmente las columnas",
                    fontSize = 12.sp,
                    color = TextSecondary
                )
            }

            IconButton(onClick = { showNewTaskDialog = true }) {
                Icon(Icons.Default.Add, contentDescription = "Nueva tarea", tint = AccentBlue)
            }
        }

        // Kanban Horizontal Scroll
        Row(
            modifier = Modifier
                .fillMaxSize()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            columns.forEach { (title, statusKey, color) ->
                val columnTasks = tasks.filter { it.status == statusKey }

                KanbanColumnCard(
                    title = title,
                    count = columnTasks.size,
                    accentColor = color,
                    tasks = columnTasks,
                    onToggleComplete = { viewModel.toggleTaskComplete(it) }
                )
            }
        }
    }

    if (showNewTaskDialog) {
        AlertDialog(
            onDismissRequest = { showNewTaskDialog = false },
            containerColor = SurfaceDark,
            title = { Text("Nueva Tarea", color = Color.White) },
            text = {
                TextField(
                    value = newTaskTitle,
                    onValueChange = { newTaskTitle = it },
                    placeholder = { Text("Título de la tarea...") },
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = SurfaceCard,
                        unfocusedContainerColor = SurfaceCard,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (newTaskTitle.isNotBlank()) {
                            viewModel.createQuickTask(newTaskTitle)
                            newTaskTitle = ""
                            showNewTaskDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = AccentBlue)
                ) {
                    Text("Crear")
                }
            },
            dismissButton = {
                TextButton(onClick = { showNewTaskDialog = false }) {
                    Text("Cancelar", color = TextSecondary)
                }
            }
        )
    }
}

@Composable
fun KanbanColumnCard(
    title: String,
    count: Int,
    accentColor: Color,
    tasks: List<AppTask>,
    onToggleComplete: (AppTask) -> Unit
) {
    Surface(
        color = SurfaceDark,
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderDark),
        modifier = Modifier
            .width(280.dp)
            .fillMaxHeight()
            .padding(horizontal = 6.dp, vertical = 4.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(accentColor, shape = RoundedCornerShape(2.dp))
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = title,
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Surface(
                    color = SurfaceCard,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "$count",
                        color = TextSecondary,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(bottom = 64.dp)
            ) {
                items(tasks) { task ->
                    Surface(
                        color = SurfaceCard,
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderDark),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onToggleComplete(task) }
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = if (task.status == "completed") Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                                contentDescription = null,
                                tint = if (task.status == "completed") AccentGreen else TextMuted,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = task.title,
                                color = Color.White,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
