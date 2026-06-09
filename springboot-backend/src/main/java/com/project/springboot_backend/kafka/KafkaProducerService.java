package com.project.springboot_backend.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.springboot_backend.model.Employee;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

@Service
public class KafkaProducerService {
    private static final Logger logger = LoggerFactory.getLogger(KafkaProducerService.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Value("${employee.events.topic:employee-events}")
    private String topic;

    public KafkaProducerService(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper.copy()
                .setSerializationInclusion(JsonInclude.Include.NON_NULL);
    }

    public void sendEmployeeCreatedEvent(Employee employee) {
        sendEvent(new EmployeeEvent("EMPLOYEE_CREATED", employee));
    }

    public void sendEmployeeUpdatedEvent(Employee oldEmployee, Employee newEmployee) {
        Map<String, EmployeeEvent.ChangeDetail> changes = new HashMap<>();
        if (!Objects.equals(oldEmployee.getFirstName(), newEmployee.getFirstName())) {
            changes.put("firstName", new EmployeeEvent.ChangeDetail(oldEmployee.getFirstName(), newEmployee.getFirstName()));
        }
        if (!Objects.equals(oldEmployee.getLastName(), newEmployee.getLastName())) {
            changes.put("lastName", new EmployeeEvent.ChangeDetail(oldEmployee.getLastName(), newEmployee.getLastName()));
        }
        if (!Objects.equals(oldEmployee.getEmailId(), newEmployee.getEmailId())) {
            changes.put("emailId", new EmployeeEvent.ChangeDetail(oldEmployee.getEmailId(), newEmployee.getEmailId()));
        }

        sendEvent(new EmployeeEvent("EMPLOYEE_UPDATED", newEmployee, changes));
    }

    public void sendEmployeeDeletedEvent(Long employeeId) {
        sendEvent(new EmployeeEvent("EMPLOYEE_DELETED", employeeId));
    }

    private void sendEvent(EmployeeEvent event) {
        try {
            String jsonMessage = objectMapper.writeValueAsString(event);
            String key = "employee-" + event.getEmployeeId();
            CompletableFuture<SendResult<String, String>> future = kafkaTemplate.send(topic, key, jsonMessage);

            future.whenComplete((result, ex) -> {
                if (ex != null) {
                    logger.error("Failed to publish {} for employee {}", event.getEventType(), event.getEmployeeId(), ex);
                    return;
                }

                logger.info("Published {} for employee {} to {}-{} offset {}",
                        event.getEventType(),
                        event.getEmployeeId(),
                        result.getRecordMetadata().topic(),
                        result.getRecordMetadata().partition(),
                        result.getRecordMetadata().offset());
            });
        } catch (JsonProcessingException ex) {
            logger.error("Failed to serialize {} for employee {}", event.getEventType(), event.getEmployeeId(), ex);
        } catch (RuntimeException ex) {
            logger.error("Failed to start Kafka publish for {} employee {}", event.getEventType(), event.getEmployeeId(), ex);
        }
    }
}
