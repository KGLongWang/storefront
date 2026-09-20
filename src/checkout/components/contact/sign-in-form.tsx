"use client";

import { type FC } from "react";
import { useTranslations } from "next-intl";

import { AibibuAuthFrame } from "@/ui/components/auth/aibibu-auth-frame";

export interface SignInFormProps {
	initialEmail?: string;
	onSuccess: () => void | Promise<void>;
	onGuestCheckout: () => void;
}

export const SignInForm: FC<SignInFormProps> = ({ onSuccess, onGuestCheckout }) => {
	const tCheckout = useTranslations("checkout.contact");

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-4">
				<h2 className="text-xl font-semibold">{tCheckout("signInTitle")}</h2>
				<button
					type="button"
					onClick={onGuestCheckout}
					className="text-sm font-medium text-foreground underline underline-offset-2 hover:no-underline"
				>
					{tCheckout("guestCheckout")}
				</button>
			</div>
			<AibibuAuthFrame onSuccess={onSuccess} />
		</div>
	);
};
