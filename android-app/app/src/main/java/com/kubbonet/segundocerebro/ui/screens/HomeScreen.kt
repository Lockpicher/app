package com.kubbonet.segundocerebro.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kubbonet.segundocerebro.data.model.AppNote
import com.kubbonet.segundocerebro.data.model.AppTask
import com.kubbonet.segundocerebro.ui.theme.*
import com.kubbonet.segundocerebro.viewmodel.MainViewModel

@Composable
fun HomeScreen(
    viewModel: MainViewModel,
    onNavigateToTasks: () -> Unit,
    onNavigateToNotebooks: () -> Unit
) {
    val tasks by viewModel.tasks.collectAsState()
    val notes by viewModel.notes.collectAsState()
    val habits by viewModel.habits.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    var quickText by remember { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .windowInsetsPadding(WindowInsets.statusBars)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 96.dp)
    ) {
        // Encabezado de Bienvenida
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Segundo Cerebro",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = "Captura, organiza y ejecuta",
                        fontSize = 13.sp,
                        color = TextSecondary
                    )
                }

                IconButton(onClick = { viewModel.loadDashboardData() }) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Actualizar",
                        tint = AccentBlue
                    )
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        // Barra de Captura Rápida Universal
        item {
            Surface(
                color = SurfaceDark,
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderDark),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextField(
                        value = quickText,
                        onValueChange = { quickText = it },
                        placeholder = { Text("Captura rápida...", color = TextMuted, fontSize = 14.sp) },
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = Color.Transparent,
                            unfocusedContainerColor = Color.Transparent,
                            disabledContainerColor = Color.Transparent,
                            focusedIndicatorColor = Color.Transparent,
                            unfocusedIndicatorColor = Color.Transparent,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        ),
                        modifier = Modifier.weight(1f)
                    )

                    IconButton(
                        onClick = {
                            if (quickText.isNotBlank()) {
                                viewModel.createQuickNote("Captura rápida", quickText)
                                quickText = ""
                            }
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Default.Send,
                            contentDescription = "Guardar",
                            tint = AccentBlue
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(20.dp))
        }

        // Sección: Hábitos del día
        if (habits.isNotEmpty()) {
            item {
                Text(
                    text = "Hábitos de Hoy",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
            }

            items(habits.take(3)) { habit ->
                Surface(
                    color = SurfaceDark,
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderDark),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 6.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(AccentGreen)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = habit.title,
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
            item { Spacer(modifier = Modifier.height(14.dp)) }
        }

        // Sección: Tareas Pendientes
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Tareas Pendientes (${tasks.count { it.status != "completed" }})",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
                Text(
                    text = "Ver todas",
                    fontSize = 12.sp,
                    color = AccentBlue,
                    modifier = Modifier.clickable { onNavigateToTasks() }
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
        }

        val pendingTasks = tasks.filter { it.status != "completed" }.take(5)
        if (pendingTasks.isEmpty()) {
            item {
                Text(
                    text = "No tienes tareas pendientes para hoy",
                    color = TextMuted,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(vertical = 12.dp)
                )
            }
        } else {
            items(pendingTasks) { task ->
                TaskItemRow(
                    task = task,
                    onToggle = { viewModel.toggleTaskComplete(task) }
                )
            }
        }

        // Sección: Notas Recientes
        item {
            Spacer(modifier = Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Notas Recientes",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
                Text(
                    text = "Ver cuadernos",
                    fontSize = 12.sp,
                    color = AccentBlue,
                    modifier = Modifier.clickable { onNavigateToNotebooks() }
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
        }

        items(notes.take(4)) { note ->
            NoteCardRow(note = note)
        }
    }
}

@Composable
fun TaskItemRow(task: AppTask, onToggle: () -> Unit) {
    val isDone = task.status == "completed"
    Surface(
        color = SurfaceDark,
        shape = RoundedCornerShape(10.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderDark),
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 6.dp)
            .clickable { onToggle() }
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (isDone) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                contentDescription = null,
                tint = if (isDone) AccentGreen else TextMuted,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = task.title,
                color = if (isDone) TextMuted else Color.White,
                fontSize = 14.sp,
                textDecoration = if (isDone) TextDecoration.LineThrough else null
            )
        }
    }
}

@Composable
fun NoteCardRow(note: AppNote) {
    Surface(
        color = SurfaceDark,
        shape = RoundedCornerShape(10.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderDark),
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 6.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = note.title,
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold
            )
            if (!note.content.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = note.content.take(80),
                    color = TextSecondary,
                    fontSize = 12.sp,
                    maxLines = 2
                )
            }
        }
    }
}
