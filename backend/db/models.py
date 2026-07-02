from datetime import datetime

from cuid2 import cuid_wrapper
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.types import JSON
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

cuid = cuid_wrapper()


def new_id() -> str:
    return cuid()


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    passwordHash: Mapped[str] = mapped_column("passwordHash", String)
    githubToken: Mapped[str | None] = mapped_column("githubToken", String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )

    projects: Mapped[list["Project"]] = relationship(back_populates="user")
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="user")


class Project(Base):
    __tablename__ = "Project"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    userId: Mapped[str] = mapped_column("userId", String, ForeignKey("User.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    prompt: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, default="draft")
    templateId: Mapped[str | None] = mapped_column("templateId", String, nullable=True)
    theme: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    user: Mapped["User"] = relationship(back_populates="projects")
    agentRuns: Mapped[list["AgentRun"]] = relationship(
        back_populates="project", passive_deletes=True
    )
    artifacts: Mapped[list["Artifact"]] = relationship(
        back_populates="project", passive_deletes=True
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="project", passive_deletes=True
    )
    generatedApp: Mapped["GeneratedApp | None"] = relationship(
        back_populates="project", passive_deletes=True
    )
    projectFiles: Mapped[list["ProjectFile"]] = relationship(
        back_populates="project", passive_deletes=True
    )
    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="project", passive_deletes=True
    )


class AgentRun(Base):
    __tablename__ = "AgentRun"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    projectId: Mapped[str] = mapped_column(
        "projectId", String, ForeignKey("Project.id", ondelete="CASCADE")
    )
    agentId: Mapped[str | None] = mapped_column("agentId", String, nullable=True)
    agentRole: Mapped[str] = mapped_column("agentRole", String)
    agentName: Mapped[str] = mapped_column("agentName", String)
    stepId: Mapped[str | None] = mapped_column("stepId", String, nullable=True)
    stepNameZh: Mapped[str | None] = mapped_column("stepNameZh", String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")
    output: Mapped[str | None] = mapped_column(Text, nullable=True)
    inputArtifactIds: Mapped[list[str]] = mapped_column(
        "inputArtifactIds", ARRAY(String), default=list
    )
    outputArtifactId: Mapped[str | None] = mapped_column(
        "outputArtifactId",
        String,
        ForeignKey("Artifact.id", ondelete="SET NULL"),
        nullable=True,
    )
    startedAt: Mapped[datetime | None] = mapped_column(
        "startedAt", DateTime(timezone=True), nullable=True
    )
    completedAt: Mapped[datetime | None] = mapped_column(
        "completedAt", DateTime(timezone=True), nullable=True
    )
    order: Mapped[int] = mapped_column("order", Integer)

    project: Mapped["Project"] = relationship(back_populates="agentRuns")
    outputArtifact: Mapped["Artifact | None"] = relationship(
        back_populates="agentRuns", foreign_keys=[outputArtifactId]
    )


class Artifact(Base):
    __tablename__ = "Artifact"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    projectId: Mapped[str] = mapped_column(
        "projectId", String, ForeignKey("Project.id", ondelete="CASCADE")
    )
    agentId: Mapped[str] = mapped_column("agentId", String)
    type: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text)
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="artifacts")
    agentRuns: Mapped[list["AgentRun"]] = relationship(
        back_populates="outputArtifact", foreign_keys="AgentRun.outputArtifactId"
    )


class Message(Base):
    __tablename__ = "Message"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    projectId: Mapped[str] = mapped_column(
        "projectId", String, ForeignKey("Project.id", ondelete="CASCADE")
    )
    role: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text)
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="messages")


class GeneratedApp(Base):
    __tablename__ = "GeneratedApp"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    projectId: Mapped[str] = mapped_column(
        "projectId", String, ForeignKey("Project.id", ondelete="CASCADE"), unique=True
    )
    html: Mapped[str] = mapped_column(Text)
    css: Mapped[str] = mapped_column(Text)
    js: Mapped[str] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1)
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    project: Mapped["Project"] = relationship(back_populates="generatedApp")


class ProjectFile(Base):
    __tablename__ = "ProjectFile"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    projectId: Mapped[str] = mapped_column(
        "projectId", String, ForeignKey("Project.id", ondelete="CASCADE")
    )
    path: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text)
    size: Mapped[int] = mapped_column(Integer, default=0)
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    project: Mapped["Project"] = relationship(back_populates="projectFiles")


class Conversation(Base):
    __tablename__ = "Conversation"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    userId: Mapped[str] = mapped_column("userId", String, ForeignKey("User.id", ondelete="CASCADE"))
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    theme: Mapped[str | None] = mapped_column(String, nullable=True)
    projectId: Mapped[str | None] = mapped_column(
        "projectId", String, ForeignKey("Project.id", ondelete="SET NULL"), nullable=True
    )
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt",
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    user: Mapped["User"] = relationship(back_populates="conversations")
    project: Mapped["Project | None"] = relationship(back_populates="conversations")
    messages: Mapped[list["ConversationMessage"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ConversationMessage(Base):
    __tablename__ = "ConversationMessage"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    conversationId: Mapped[str] = mapped_column(
        "conversationId", String, ForeignKey("Conversation.id", ondelete="CASCADE")
    )
    role: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text)
    agentId: Mapped[str | None] = mapped_column("agentId", String, nullable=True)
    agentName: Mapped[str | None] = mapped_column("agentName", String, nullable=True)
    reactSteps: Mapped[list | None] = mapped_column("reactSteps", JSON, nullable=True)
    messageType: Mapped[str | None] = mapped_column("messageType", String, nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    status: Mapped[str | None] = mapped_column("status", String, nullable=True)
    stepCount: Mapped[int | None] = mapped_column("stepCount", Integer, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", DateTime(timezone=True), server_default=func.now()
    )

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
