import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyModule } from "@/components/employee-screen";
import { TalentNetworkDiscoveryView } from "@/components/talent-network/talent-network-discovery-view";
import { AchievementsSection } from "@/components/talent/achievements-section";
import { CertificationsSection } from "@/components/talent/certifications-section";
import { EducationSection } from "@/components/talent/education-section";
import { ExperienceSection } from "@/components/talent/experience-section";
import { ProfessionalOverviewCard } from "@/components/talent/professional-overview-card";
import { ProjectsSection } from "@/components/talent/projects-section";
import { ResumeSection } from "@/components/talent/resume-section";
import { SkillsSection } from "@/components/talent/skills-section";
import { TalentHeaderCard } from "@/components/talent/talent-header-card";
import { TalentInitCard } from "@/components/talent/talent-init-card";
import { colors, spacing, typography } from "@/constants/design-system";
import { useAuth } from "@/features/auth/auth-provider";
import { getSupabase } from "@/lib/supabase";
import { isTalentViewer } from "@/types/roles";
import type {
  Achievement,
  Certification,
  Education,
  EmployeeSkill,
  Experience,
  Project,
  Resume,
  TalentProfile,
} from "@/types/talent";

type EmployeeBase = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  designation_name: string | null;
};

export default function TalentScreen() {
  const { session, identity, isReady } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const isViewer = isTalentViewer(identity?.roles);
  const isAuthLoading = !isReady || Boolean(session && !identity);

  const [employeeBase, setEmployeeBase] = useState<EmployeeBase | null>(null);
  const [profile, setProfile] = useState<TalentProfile | null>(null);
  const [skills, setSkills] = useState<EmployeeSkill[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [educationList, setEducationList] = useState<Education[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [resume, setResume] = useState<Resume | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTalentData = useCallback(
    async (isRefresh = false) => {
      if (!session || isViewer || isAuthLoading) {
        setIsLoading(false);
        return;
      }

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const supabase = getSupabase();

        // 1. Fetch current employee base details
        const { data: empData, error: empError } = await supabase
          .from("employees")
          .select(
            "id, employee_code, first_name, last_name, designations(name)",
          )
          .eq("profile_id", session.user.id)
          .maybeSingle();

        if (empError) {
          setError(
            "Could not load employee details. Please check your connection.",
          );
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }

        if (!empData) {
          setError(
            "Employee record not found. Please contact your administrator.",
          );
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }

        const designationName =
          (empData.designations as unknown as { name?: string } | null)?.name ??
          null;

        setEmployeeBase({
          id: empData.id,
          employee_code: empData.employee_code,
          first_name: empData.first_name,
          last_name: empData.last_name,
          designation_name: designationName,
        });

        const empId = empData.id;

        // 2. Fetch talent profile
        const { data: profileData, error: profileError } = await supabase
          .from("talent_profiles")
          .select("*")
          .eq("employee_id", empId)
          .maybeSingle();

        if (profileError) {
          setError("Could not load Talent Profile.");
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }

        setProfile(profileData as TalentProfile | null);

        // If talent profile exists, fetch child professional sections
        if (profileData) {
          const [
            skillsRes,
            expRes,
            eduRes,
            certRes,
            projRes,
            achRes,
            resumeRes,
          ] = await Promise.all([
            supabase
              .from("employee_skills")
              .select(
                "id, employee_id, skill_id, proficiency, review_status, reviewer_notes, skills(id, name, category)",
              )
              .eq("employee_id", empId)
              .order("created_at", { ascending: false }),
            supabase
              .from("experiences")
              .select("*")
              .eq("employee_id", empId)
              .order("start_date", { ascending: false }),
            supabase
              .from("education")
              .select("*")
              .eq("employee_id", empId)
              .order("start_date", { ascending: false }),
            supabase
              .from("certifications")
              .select("*")
              .eq("employee_id", empId)
              .order("created_at", { ascending: false }),
            supabase
              .from("projects")
              .select("*")
              .eq("employee_id", empId)
              .order("created_at", { ascending: false }),
            supabase
              .from("achievements")
              .select("*")
              .eq("employee_id", empId)
              .order("created_at", { ascending: false }),
            supabase
              .from("resumes")
              .select("*")
              .eq("employee_id", empId)
              .maybeSingle(),
          ]);

          if (skillsRes.data) {
            const mappedSkills: EmployeeSkill[] = skillsRes.data.map((item) => {
              const skillObj = item.skills as unknown as {
                id: string;
                name: string;
                category: string | null;
              } | null;
              return {
                id: item.id,
                employee_id: item.employee_id,
                skill_id: item.skill_id,
                proficiency: item.proficiency,
                review_status: item.review_status,
                reviewer_notes: item.reviewer_notes,
                skill_name: skillObj?.name ?? "Unknown Skill",
                skill_category: skillObj?.category ?? null,
              };
            });
            setSkills(mappedSkills);
          }

          if (expRes.data) setExperiences(expRes.data as Experience[]);
          if (eduRes.data) setEducationList(eduRes.data as Education[]);
          if (certRes.data) setCertifications(certRes.data as Certification[]);
          if (projRes.data) setProjects(projRes.data as Project[]);
          if (achRes.data) setAchievements(achRes.data as Achievement[]);
          if (resumeRes.data) setResume(resumeRes.data as Resume);
          else setResume(null);
        }
      } catch {
        setError("An unexpected error occurred while loading talent data.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [session, isViewer, isAuthLoading],
  );

  useEffect(() => {
    const timer = setTimeout(() => void loadTalentData(), 0);
    return () => clearTimeout(timer);
  }, [loadTalentData]);

  if (isAuthLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isViewer) {
    const orgId = typeof params.orgId === "string" ? params.orgId : undefined;
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <TalentNetworkDiscoveryView
          initialOrgId={orgId}
          onNavigateToOrganizations={() =>
            router.push("/(app)/(tabs)/organizations" as any)
          }
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              onRefresh={() => void loadTalentData(true)}
              refreshing={isRefreshing}
            />
          }
        >
          <Text style={styles.screenTitle}>Talent</Text>
          <EmptyModule title="Talent unavailable" message={error} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void loadTalentData(true)}
            refreshing={isRefreshing}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.screenTitle}>Talent</Text>

        {!profile && employeeBase ? (
          <TalentInitCard
            defaultName={`${employeeBase.first_name} ${employeeBase.last_name}`}
            defaultTitle={employeeBase.designation_name}
            employeeId={employeeBase.id}
            onInitialized={() => void loadTalentData()}
          />
        ) : profile && employeeBase ? (
          <>
            {/* 1. Talent ID & Verification Status Header */}
            <TalentHeaderCard profile={profile} />

            {/* 2. Professional Overview (Name, Title, Summary, Visibility) */}
            <ProfessionalOverviewCard
              onUpdated={() => void loadTalentData()}
              profile={profile}
            />

            {/* 3. Skills & Proficiencies */}
            <SkillsSection
              onUpdated={() => void loadTalentData()}
              skills={skills}
            />

            {/* 4. Work Experience */}
            <ExperienceSection
              employeeId={employeeBase.id}
              experiences={experiences}
              onUpdated={() => void loadTalentData()}
            />

            {/* 5. Education & Qualifications */}
            <EducationSection
              educationList={educationList}
              employeeId={employeeBase.id}
              onUpdated={() => void loadTalentData()}
            />

            {/* 6. Certifications & Credentials */}
            <CertificationsSection
              certifications={certifications}
              employeeId={employeeBase.id}
              onUpdated={() => void loadTalentData()}
            />

            {/* 7. Projects & Portfolio */}
            <ProjectsSection
              employeeId={employeeBase.id}
              onUpdated={() => void loadTalentData()}
              projects={projects}
            />

            {/* 8. Achievements & Honors */}
            <AchievementsSection
              achievements={achievements}
              employeeId={employeeBase.id}
              onUpdated={() => void loadTalentData()}
            />

            {/* 9. Resume & Documents */}
            <ResumeSection
              employeeId={employeeBase.id}
              onUpdated={() => void loadTalentData()}
              resume={resume}
            />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  centerContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  screenTitle: {
    color: colors.ink,
    ...typography.title,
  },
});
