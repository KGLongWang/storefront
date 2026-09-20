"use client";

import { type FC } from "react";
import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/ui/components/ui/input";
import { cn } from "@/lib/utils";
import { contactFieldAttributes } from "@/checkout/lib/consts/input-attributes";

// Re-export for backward compatibility
export { FormInput, FieldError } from "@/checkout/views/saleor-checkout/address-form-fields";

export interface GuestContactProps {
	/** Current email value */
	email: string;
	/** Called when email changes */
	onEmailChange: (email: string) => void;
	/** Called when email field loses focus (for validation) */
	onEmailBlur?: () => void;
	/** Email validation error */
	emailError?: string;
	/** Called when user wants to sign in */
	onSignInClick: () => void;
}

/**
 * Guest checkout contact section.
 */
export const GuestContact: FC<GuestContactProps> = ({
	email,
	onEmailChange,
	onEmailBlur,
	emailError,
	onSignInClick,
}) => {
	const t = useTranslations("account");
	const tCheckout = useTranslations("checkout");

	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-semibold">{tCheckout("contact.title")}</h2>
				<p className="text-sm text-muted-foreground">
					{tCheckout("contact.haveAccount")}{" "}
					<button
						type="button"
						onClick={onSignInClick}
						className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
					>
						{tCheckout("actions.logIn")}
					</button>
				</p>
			</div>

			<div className="space-y-1.5">
				<div className="relative">
					<Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						type="email"
						name={contactFieldAttributes.email.name}
						inputMode={contactFieldAttributes.email.inputMode}
						placeholder={t("fields.emailAddress")}
						value={email}
						onChange={(e) => onEmailChange(e.target.value)}
						onBlur={onEmailBlur}
						autoComplete={contactFieldAttributes.email.autoComplete}
						className={cn("h-12 pl-10", emailError && "border-destructive")}
						aria-invalid={!!emailError}
						aria-describedby={emailError ? "email-error" : undefined}
					/>
				</div>
				{emailError && (
					<p id="email-error" role="alert" className="text-sm text-destructive">
						{emailError}
					</p>
				)}
			</div>
		</section>
	);
};
