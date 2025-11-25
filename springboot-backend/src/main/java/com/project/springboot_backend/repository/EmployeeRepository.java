package com.project.springboot_backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.project.springboot_backend.model.Employee;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee,Long>{

}
